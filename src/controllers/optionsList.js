import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";

/**
 * Controller for fetching generic lists for dropdowns.
 * Maintained with high flexibility to support multiple modules as per legacy.
 */
class OptionsListController {
  getList = async (req, res) => {
    try {
      const { module: table, searchString = "", page, size, column = "name", branch } = req.body;
      const parsedPage = parseInt(page) || 1;
      const parsedSize = parseInt(size) || 10;
      const skip = (parsedPage - 1) * parsedSize;
      const take = parsedSize === 0 ? undefined : parsedSize;

      // Fetch manufacturers associated with the user's branches for filtering
      let branchIds = req.body.branch || req.user?.branch || [];
      // Default to Devanahalli if no branches assigned
      if ((!branchIds || (Array.isArray(branchIds) && branchIds.length === 0))) {
        branchIds = ["ck8g589vj499008806oh90nmx"]; // Devanahalli
      }

      const userBranches = await prisma.branch.findMany({
        where: { id: { in: Array.isArray(branchIds) ? branchIds : [branchIds] } },
        include: { manufacturer: true }
      });
      const allowedManufacturerIds = userBranches.flatMap(b => b.manufacturer.map(m => m.id));

      switch (table) {
        case "customers":
          optionsList = await prisma.customer.findMany({
            where: {
              OR: [
                ...orConditions,
                { CustomerPhone: { some: { phone: { contains: queryStr } } } }
              ]
            },
            include: { CustomerPhone: true },
            take,
            skip
          });
          // Map CustomerPhone to contacts for parity
          optionsList = optionsList.map(c => ({ ...c, contacts: c.CustomerPhone }));
          break;

        case "user":
          optionsList = await prisma.user.findMany({
            where: {
              EmployeeProfile_User_profileToEmployeeProfile: {
                OR: [
                  { employeeName: { contains: queryStr, mode: 'insensitive' } },
                  { employeeId: { contains: queryStr, mode: 'insensitive' } }
                ]
              }
            },
            include: {
              EmployeeProfile_User_profileToEmployeeProfile: {
                include: {
                  department: true,
                  branch: true
                }
              }
            }
          });
          // Map to legacy profile structure
          optionsList = optionsList.map(u => ({
            ...u,
            profile: u.EmployeeProfile_User_profileToEmployeeProfile
          }));
          break;

        case "vehicleMasters":
        case "vehicleMastersPMC":
          optionsList = await prisma.vehicleMaster.findMany({
            where: {
              manufacturer: { in: allowedManufacturerIds },
              vehicleStatus: table === "vehicleMasters" ? "AVAILABLE" : undefined,
              OR: [
                { modelName: { contains: queryStr, mode: 'insensitive' } },
                { modelCode: { contains: queryStr, mode: 'insensitive' } }
              ]
            },
            include: { Manufacturer: true, images: true, services: true },
            take: 100
          });
          break;

        case "partsMasters":
          optionsList = await prisma.partsMaster.findMany({
            where: {
              manufacturerId: { in: allowedManufacturerIds },
              OR: [
                { partName: { contains: queryStr, mode: 'insensitive' } },
                { partNumber: { contains: queryStr, mode: 'insensitive' } }
              ]
            },
            include: { manufacturer: true, hsn: true },
            take: 100
          });
          break;

        case "vehicles":
          optionsList = await prisma.vehicle.findMany({
            where: {
              manufacturer: { in: allowedManufacturerIds },
              OR: [
                { registerNo: { contains: queryStr, mode: 'insensitive' } },
                { chassisNo: { contains: queryStr, mode: 'insensitive' } },
                { engineNo: { contains: queryStr, mode: 'insensitive' } }
              ]
            },
            include: {
              vehicleMaster: { include: { Manufacturer: true } },
              Customer: { include: { CustomerPhone: true } },
              color: true
            },
            take,
            skip
          });
          // Format as per SoldVehicle expectations
          optionsList = optionsList.map(v => ({
            ...v,
            vehicle: v.vehicleMaster,
            customer: (v.Customer || []).map(c => ({ id: c.id, customer: c }))
          }));
          break;

        case "jobOrders":
          optionsList = await prisma.jobOrder.findMany({
            where: {
              OR: [
                { jobNo: { contains: queryStr, mode: 'insensitive' } },
                { vehicle: { registerNo: { contains: queryStr, mode: 'insensitive' } } },
                { customer: { name: { contains: queryStr, mode: 'insensitive' } } }
              ]
            },
            include: {
              vehicle: { include: { vehicleMaster: true } },
              customer: { include: { CustomerPhone: true } },
              branch: true
            },
            take,
            skip
          });
          break;

        default:
          // Try generic findMany if table matches a model name (lowercased)
          const modelMapping = {
            "branches": "branch",
            "manufacturers": "manufacturer",
            "suppliers": "supplier",
            "financers": "financer",
            "departments": "department"
          };
          const prismaModel = modelMapping[table] || table.replace(/s$/, ""); // Simple plural to singular
          
          if (prisma[prismaModel]) {
            const where = {
              OR: orConditions
            };

            // Specific filtering for manufacturers
            if (table === "manufacturers") {
              where.id = { in: allowedManufacturerIds };
              if (req.body.vehicleManufacturer !== undefined) {
                where.vehicleManufacturer = req.body.vehicleManufacturer === true || req.body.vehicleManufacturer === "true";
              }
            }

            optionsList = await prisma[prismaModel].findMany({
              where,
              take,
              skip
            });
          }
      }

      return res.json({
        code: 200,
        response: optionsList
      });
    } catch (err) {
      logger.error("OptionsList getList error:", err);
      return res.json({ code: 500, response: [], msg: "An error occurred" });
    }
  };

  getManufacturerVehicles = async (req, res) => {
    try {
      const { id } = req.params;
      const vehicles = await prisma.vehicleMaster.findMany({
        where: { manufacturer: id },
        include: { Manufacturer: true, images: true, services: true, prices: true, files: true }
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          data: vehicles.map(v => ({
            ...v,
            manufacturer: v.Manufacturer,
            image: v.images,
            price: v.prices,
            file: v.files
          }))
        }
      });
    } catch (err) {
      logger.error("OptionsList getManufacturerVehicles error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };
}

export default new OptionsListController();

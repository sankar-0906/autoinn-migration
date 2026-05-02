import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../services/helper/titleCase.js";

/**
 * Controller for fetching generic lists for dropdowns.
 */
class OptionsListController {
  getList = async (req, res) => {
    try {
      const { module: table, searchString = "", page = 1, size = 10, column = "name", branch } = req.body;
      const skip = (parseInt(page) - 1) * parseInt(size);
      const take = parseInt(size);

      let optionsList = [];
      const queryStr = searchString || "";
      const orConditions = [
        { [column]: { contains: queryStr, mode: 'insensitive' } }
      ];

      switch (table) {
        case "customers":
          optionsList = await prisma.customer.findMany({
            where: {
              OR: [
                ...orConditions,
                { contacts: { some: { phone: { contains: queryStr } } } }
              ]
            },
            take,
            skip
          });
          break;

        case "user":
          optionsList = await prisma.user.findMany({
            where: {
              EmployeeProfile_User_profileToEmployeeProfile: {
                employeeName: { contains: queryStr, mode: 'insensitive' }
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
          break;

        case "vehicleMasters":
          optionsList = await prisma.vehicleMaster.findMany({
            where: {
              vehicleStatus: "AVAILABLE",
              OR: [
                ...orConditions,
                { modelCode: { contains: queryStr, mode: 'insensitive' } }
              ]
            },
            take: 100
          });
          break;

        case "partsMasters":
          optionsList = await prisma.partsMaster.findMany({
            where: {
              OR: [
                { partName: { contains: queryStr, mode: 'insensitive' } },
                { partNumber: { contains: queryStr, mode: 'insensitive' } }
              ]
            },
            take: 100
          });
          break;

        default:
          // Try generic findMany if table matches a model name (lowercased)
          const modelName = Object.keys(prisma).find(k => k.toLowerCase() === table.toLowerCase());
          if (modelName && prisma[modelName].findMany) {
            optionsList = await prisma[modelName].findMany({
              where: {
                OR: orConditions
              },
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
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getManufacturerVehicles = async (req, res) => {
    try {
      const { id } = req.params;
      const vehicles = await prisma.vehicleMaster.findMany({
        where: { manufacturerId: id }
      });
      return res.json({
        code: 200,
        response: vehicles
      });
    } catch (err) {
      logger.error("OptionsList getManufacturerVehicles error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };
}

export default new OptionsListController();

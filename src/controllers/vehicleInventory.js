import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";
import VehicleMasterController from "./vehicleMaster.js";

/**
 * Controller for Vehicle Inventory operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class VehicleInventoryController {
  // Shared include object to mirror the legacy fragment
  inventoryInclude = {
    vehicle: {
      include: {
        manufacturer: true,
        image: true,
        file: true,
        price: true,
        hsn: true
      }
    },
    branch: true,
    color: true,
    vehiclePurchase: {
      include: {
        purchaseChallan: {
          include: {
            supplier: {
              include: { contact: true }
            },
            branch: {
              include: { contacts: true }
            }
          }
        }
      }
    }
  };

  /**
   * Transforms Prisma inventory record to match legacy frontend expectations.
   * This handles flattening of nested objects and aliasing of renamed fields.
   */
  formatInventory = (inv, req) => {
    if (!inv) return inv;
    const formattedVehicle = inv.vehicle ? VehicleMasterController.formatVehicleMaster(inv.vehicle, req) : null;
    
    const transformed = {
      ...inv,
      // Restore relations as objects (don't overwrite with IDs)
      branch: inv.branch || null,
      color: inv.color || null,
      vehiclePurchase: inv.vehiclePurchase || null,
      
      // Scalar IDs (legacy aliases)
      branchId: inv.branchId || null,
      colorId: inv.colorId || null,
      vehiclePurchaseId: inv.vehiclePurchaseId || null,
      
      // PascalCase Relations for frontend parity
      VehicleMaster: formattedVehicle,
      Branch: inv.branch || null,
      Image: inv.color || null, 
      Color: inv.color || null,
      VehiclePurchaseInvoice: inv.vehiclePurchase || null,
      
      // Lowercase Relations
      vehicle: formattedVehicle,
      
      // Flattened fields for Table Columns & Cost Calculations
      location: inv.branch?.name || "",
      branchName: inv.branch?.name || "",
      modelName: formattedVehicle?.modelName,
      modelCode: formattedVehicle?.modelCode,
      category: formattedVehicle?.category,
      
      // Multiple cost aliases to prevent NaN in frontend reducers
      purchasePrice: inv.vehiclePurchase?.netAmount || 0,
      rate: inv.vehiclePurchase?.amount || 0,
      netAmount: inv.vehiclePurchase?.netAmount || 0,
      amount: inv.vehiclePurchase?.amount || 0,
      totalCost: inv.vehiclePurchase?.netAmount || 0,
      
      quantity: 1,
      colorName: inv.color?.color || "",
      imageDetails: inv.color ? [inv.color] : []
    };

    return transformed;
  };

  createVehicleInventory = async (req, res) => {
    try {
      const { vehicleDetail, inventoryBranch } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      let createdInventories = [];
      for (const detail of vehicleDetail) {
        const created = await prisma.vehicleInventory.create({
          data: {
            chassisNo: detail.chassisNo,
            engineNo: detail.engineNo,
            keyNo: detail.keyNo,
            warrantyBookNo: detail.warrantyBookNo,
            batteryNo: detail.batteryNo,
            manMonthYear: detail.manMonthYear,
            Status: "Avaliable",
            createdAt: new Date(),
            vehicle: { connect: { id: detail.vehicle } },
            branch: inventoryBranch ? { connect: { id: inventoryBranch } } : undefined,
            color: detail.color ? { connect: { id: detail.color } } : undefined,
            createdBy: user ? { connect: { id: user } } : undefined
          },
          include: this.inventoryInclude
        });
        createdInventories.push(created);
      }

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Spares Inventory created",
          data: createdInventories[createdInventories.length - 1] ? this.formatInventory(createdInventories[createdInventories.length - 1], req) : null
        }
      });
    } catch (err) {
      logger.error("Create vehicle inventory error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getAll = async (req, res) => {
    try {
      const inventories = await prisma.vehicleInventory.findMany({
        include: this.inventoryInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "inventories fetched",
          data: inventories.map(inv => this.formatInventory(inv, req))
        }
      });
    } catch (err) {
      logger.error("Get all inventories error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const inventory = await prisma.vehicleInventory.findUnique({
        where: { id },
        include: this.inventoryInclude
      });

      if (inventory) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "inventory fetched",
            data: this.formatInventory(inventory, req)
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one inventory error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page = 1, size = 10, searchString, branch } = req.body;

      // Support both branch from body and branch from token
      let branchIds = [];
      if (branch) {
        branchIds = Array.isArray(branch) ? branch : [branch];
      } else {
        const userBranches = req.user?.branch || [];
        branchIds = Array.isArray(userBranches) ? userBranches : [userBranches];
      }

      const pg = (page - 1) * size;
      const inputValue = searchString || "";
      const searchTerm = `%${inputValue}%`;

      let rows;
      let countRows;

      if (inputValue.trim() !== "") {
        // Search query with filter
        rows = await prisma.$queryRaw`
          WITH VehicleCounts AS (
            SELECT "vehicle" AS vid, "color" AS cid, "branch" AS bid, COUNT(*) AS quantity
            FROM "VehicleInventory"
            WHERE "branch" = ANY(${branchIds})
            GROUP BY "vehicle", "color", "branch"
          )
          SELECT DISTINCT ON (vi."vehicle", vi."color", vi."branch")
            vi.id,
            vi."vehicle" AS vehicle_id,
            vi."color" AS color_id,
            vi."branch" AS branch_id,
            vi."Status",
            v."modelName",
            v."modelCode",
            v.category,
            c.url,
            c.code,
            c.color AS color_name,
            vc.quantity AS quantity,
            b.name AS branch_name,
            (
              SELECT COUNT(*) FROM "VehicleInventory" vi2
              LEFT JOIN "VehicleMaster" v2 ON vi2.vehicle = v2.id
              LEFT JOIN "Image" c2 ON vi2.color = c2.id
              WHERE vi2.branch = ANY(${branchIds})
                AND (v2."modelName" ILIKE ${searchTerm} OR v2."modelCode" ILIKE ${searchTerm}
                  OR v2.category ILIKE ${searchTerm} OR c2.color ILIKE ${searchTerm}
                  OR c2.code ILIKE ${searchTerm} OR vi2."chassisNo" ILIKE ${searchTerm})
            ) AS total_count
          FROM "VehicleInventory" vi
          LEFT JOIN "VehicleMaster" v ON vi.vehicle = v.id
          LEFT JOIN "Image" c ON vi.color = c.id
          LEFT JOIN VehicleCounts vc ON vi.vehicle = vc.vid AND vi.color = vc.cid AND vi.branch = vc.bid
          LEFT JOIN "Branch" b ON vi.branch = b.id
          WHERE vi.branch = ANY(${branchIds})
            AND (v."modelName" ILIKE ${searchTerm} OR v."modelCode" ILIKE ${searchTerm}
              OR v.category ILIKE ${searchTerm} OR c.color ILIKE ${searchTerm}
              OR c.code ILIKE ${searchTerm} OR vi."chassisNo" ILIKE ${searchTerm})
          LIMIT ${size} OFFSET ${pg}
        `;
      } else {
        // No search — return all grouped rows
        rows = await prisma.$queryRaw`
          WITH VehicleCounts AS (
            SELECT "vehicle" AS vid, "color" AS cid, "branch" AS bid, COUNT(*) AS quantity
            FROM "VehicleInventory"
            WHERE "branch" = ANY(${branchIds})
            GROUP BY "vehicle", "color", "branch"
          )
          SELECT DISTINCT ON (vi."vehicle", vi."color", vi."branch")
            vi.id,
            vi."vehicle" AS vehicle_id,
            vi."color" AS color_id,
            vi."branch" AS branch_id,
            vi."Status",
            v."modelName",
            v."modelCode",
            v.category,
            c.url,
            c.code,
            c.color AS color_name,
            vc.quantity AS quantity,
            b.name AS branch_name,
            (SELECT COUNT(*) FROM VehicleCounts) AS total_count
          FROM "VehicleInventory" vi
          LEFT JOIN "VehicleMaster" v ON vi.vehicle = v.id
          LEFT JOIN "Image" c ON vi.color = c.id
          LEFT JOIN VehicleCounts vc ON vi.vehicle = vc.vid AND vi.color = vc.cid AND vi.branch = vc.bid
          LEFT JOIN "Branch" b ON vi.branch = b.id
          WHERE vi.branch = ANY(${branchIds})
          LIMIT ${size} OFFSET ${pg}
        `;
      }

      const count = rows.length > 0 ? Number(rows[0].total_count) : 0;

      // Compute total cost from latest price per vehicle
      const vehicleIds = [...new Set(rows.map(r => r.vehicle_id).filter(Boolean))];
      let totalCostMap = {};
      if (vehicleIds.length > 0) {
        const prices = await prisma.vehiclePrice.findMany({
          where: { vehicleModelId: { in: vehicleIds } },
          orderBy: { priceValidFrom: 'desc' }
        });
        for (const p of prices) {
          if (!totalCostMap[p.vehicleModelId]) {
            totalCostMap[p.vehicleModelId] = p.showroomPrice || 0;
          }
        }
      }

      // Format rows to match legacy shape
      // Note: Prisma $queryRaw preserves quoted column names casing, unquoted become lowercase
      const VehicleInventory = rows.map(r => {
        const colorObj = {
          id: r.color_id,
          url: r.url || "",
          code: r.code || "",
          color: r.color_name || ""
        };
        const branchObj = {
          id: r.branch_id,
          name: r.branch_name || ""
        };
        return {
          id: r.id,
          // Vehicle master id (used by VehicleModal to fetch individual records)
          vehicle: r.vehicle_id,
          vehicleId: r.vehicle_id,
          // Flat fields for table columns
          modelName: r.modelname || r.modelName || "",
          modelCode: r.modelcode || r.modelCode || "",
          category: r.category || "",
          Status: r.Status || r.status || "Avaliable",
          quantity: Number(r.quantity) || 1,
          // Nested objects for column renderers
          color: colorObj,
          branch: branchObj,
          // Aliases for backward compat
          colorId: r.color_id,
          branchId: r.branch_id,
          location: r.branch_name || "",
          branchName: r.branch_name || "",
          colorName: r.color_name || "",
          imageDetails: r.url ? [{ id: r.color_id, url: r.url, color: r.color_name, code: r.code }] : []
        };
      });

      const total = VehicleInventory.reduce((sum, inv) => {
        const price = totalCostMap[inv.vehicle] || 0;
        return sum + (Number(price) * Number(inv.quantity));
      }, 0);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Vehicle Inventories  fetched",
          data: {
            count,
            total,
            vehicleInventory: VehicleInventory,
            VehicleInventory
          }
        }
      });
    } catch (err) {
      logger.error("Get vehicle inventory page error:", err);
      return res.json({ code: 500, msg: "an error occurred", error: err.message });
    }
  };

  getInventoryCounts = async (req, res) => {
    try {
      const { branch } = req.body;
      const branchIds = Array.isArray(branch) ? branch : (branch ? [branch] : []);

      const whereClause = branchIds.length > 0
        ? { branchId: { in: branchIds } }
        : {};

      // Fetch all inventory records with vehicle & branch for grouping
      const allInventories = await prisma.vehicleInventory.findMany({
        where: whereClause,
        include: {
          vehicle: { select: { category: true } },
          branch: { select: { name: true } }
        }
      });

      // Group by branch (branch_name + count)
      const branchMap = {};
      for (const inv of allInventories) {
        const branchName = inv.branch?.name || "Unknown";
        if (!branchMap[branchName]) branchMap[branchName] = 0;
        branchMap[branchName]++;
      }
      const branchWise = Object.entries(branchMap).map(([branch_name, count]) => ({
        branch_name,
        count
      }));

      // Group by vehicle category
      const categoryMap = {};
      for (const inv of allInventories) {
        const cat = inv.vehicle?.category || "Unknown";
        if (!categoryMap[cat]) categoryMap[cat] = 0;
        categoryMap[cat]++;
      }
      const categoryWise = Object.entries(categoryMap).map(([category, count]) => ({
        category,
        count
      }));

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Inventory counts fetched",
          data: {
            branchWise,
            categoryWise,
            total: allInventories.length
          }
        }
      });
    } catch (err) {
      logger.error("Get inventory counts error:", err);
      return res.json({ code: 500, msg: "an error occurred", error: err.message });
    }
  };
  /**
   * Called from VehicleModal when user clicks a grouped row.
   * Frontend sends: { vehicle: vehicleMasterId, color: colorId, branch: [branchId,...] }
   * Returns all individual inventory records for that vehicle model + color + branch.
   * Matches legacy getInventories behaviour.
   */
  getVehiclesByModel = async (req, res) => {
    try {
      const { vehicle: vehicleMasterId, color: colorId, branch } = req.body;
      const branchIds = Array.isArray(branch) ? branch : (branch ? [branch] : []);

      const where = {
        ...(vehicleMasterId ? { vehicleId: vehicleMasterId } : {}),
        ...(colorId ? { colorId } : {}),
        ...(branchIds.length > 0 ? { branchId: { in: branchIds } } : {})
      };

      const inventories = await prisma.vehicleInventory.findMany({
        where,
        include: this.inventoryInclude
      });

      // Sort by manMonthYear (oldest first) — matches legacy sort
      inventories.sort((a, b) => {
        const parseDate = (str) => str ? new Date(str + " 01") : new Date(0);
        return parseDate(a.manMonthYear) - parseDate(b.manMonthYear);
      });

      const formatted = inventories.map(inv => this.formatInventory(inv, req));

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Vehicles fetched",
          data: formatted
        }
      });
    } catch (err) {
      logger.error("Get vehicles by model error:", err);
      return res.json({ code: 500, msg: "an error occurred", error: err.message });
    }
  };
}

export default new VehicleInventoryController();

import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

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
            updatedAt: new Date(),
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
          data: createdInventories[createdInventories.length - 1] // Parity with legacy loop behavior
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
          data: inventories
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
            data: inventory
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
      const { page, size, searchString } = req.body;
      const branchIds = req.user?.branch || [];
      const skip = (page - 1) * size;
      const inputValue = searchString || "";
      const tCased = await titleCase(inputValue);

      const where = {
        branchId: { in: Array.isArray(branchIds) ? branchIds : [branchIds] },
        OR: [
          { chassisNo: { contains: inputValue, mode: 'insensitive' } },
          { engineNo: { contains: inputValue, mode: 'insensitive' } },
          { vehicle: { modelName: { contains: inputValue, mode: 'insensitive' } } },
          { vehicle: { modelName: { contains: tCased, mode: 'insensitive' } } }
        ]
      };

      const [inventories, count] = await Promise.all([
        prisma.vehicleInventory.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.inventoryInclude
        }),
        prisma.vehicleInventory.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Vehicle Inventories  fetched",
          data: { count, vehicleInventory: inventories }
        }
      });
    } catch (err) {
      logger.error("Get vehicle inventory page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  getInventoryCounts = async (req, res) => {
    try {
      const { branch } = req.body;
      const counts = await prisma.vehicleInventory.groupBy({
        by: ['Status'],
        where: { branchId: branch },
        _count: { _all: true }
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Inventory counts fetched",
          data: counts
        }
      });
    } catch (err) {
      logger.error("Get inventory counts error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };
}

export default new VehicleInventoryController();

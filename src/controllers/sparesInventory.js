import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Spares Inventory operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class SparesInventoryController {
  // Shared include object to mirror the legacy fragment
  inventoryInclude = {
    Part: {
      include: {
        manufacturer: true,
        hsn: true
      }
    },
    branch: true,
    sparesPurchase: {
      include: {
        supplier: true
      }
    },
    sparesSale: true,
    Transcations: {
      include: {
        Part: true
      }
    }
  };

  createSparesInventory = async (req, res) => {
    try {
      const { partId, branchId, quantity, type } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.sparesInventory.create({
        data: {
          quantity: parseFloat(quantity) || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          Part: { connect: { id: partId } },
          branch: { connect: { id: branchId } },
          createdBy: user ? { connect: { id: user } } : undefined
        },
        include: this.inventoryInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Spares Inventory created",
          data: created
        }
      });
    } catch (err) {
      logger.error("Create spares inventory error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getAllByBranch = async (req, res) => {
    try {
      const branchIds = req.body.branch || req.user?.branch || [];
      const inventories = await prisma.sparesInventory.findMany({
        where: { branchId: { in: Array.isArray(branchIds) ? branchIds : [branchIds] } },
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
      logger.error("Get spares by branch error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
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
        Part: {
          OR: [
            { partName: { contains: inputValue, mode: 'insensitive' } },
            { partName: { contains: tCased, mode: 'insensitive' } },
            { partNumber: { contains: inputValue, mode: 'insensitive' } }
          ]
        }
      };

      const [inventories, count] = await Promise.all([
        prisma.sparesInventory.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.inventoryInclude
        }),
        prisma.sparesInventory.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Spares Inventories  fetched",
          data: { count, sparesInventory: inventories }
        }
      });
    } catch (err) {
      logger.error("Get spares inventory page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };
}

export default new SparesInventoryController();

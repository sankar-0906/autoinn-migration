import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Adjust Spares Inventory operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class AdjustSparesInventoryController {
  // Shared include object for AdjustSparesInventory to mirror legacy fragment
  adjustInclude = {
    partNo: {
      include: {
        manufacturer: true,
        hsn: true
      }
    },
    branch: true,
    adjustByUser: {
      include: {
        EmployeeProfile_User_profileToEmployeeProfile: true
      }
    }
  };

  /**
   * Helper to format AdjustSparesInventory records for legacy compatibility
   */
  formatAdjustment = (adj) => {
    if (!adj) return adj;
    
    const formattedUser = adj.adjustByUser ? {
      ...adj.adjustByUser,
      employeeName: adj.adjustByUser.EmployeeProfile_User_profileToEmployeeProfile?.employeeName || "",
      profile: adj.adjustByUser.EmployeeProfile_User_profileToEmployeeProfile || null
    } : null;

    return {
      ...adj,
      adjustByUser: formattedUser,
      AdjustByUser: formattedUser,
      // Field aliases for legacy parity
      partName: adj.partNo?.partName,
      partNumber: adj.partNo?.partNumber,
      displayName: adj.partNo?.displayName,
      employeeName: formattedUser?.employeeName || ""
    };
  };

  get = async (req, res) => {
    try {
      const { page = 1, size = 10, searchString, branch } = req.body;
      const skip = (page - 1) * size;
      const inputValue = searchString ? searchString.trim() : "";
      const tCased = await titleCase(inputValue);

      let branchIds = [];
      if (branch) {
        branchIds = Array.isArray(branch) ? branch : [branch];
      }

      let where = {};
      if (branchIds.length > 0) {
        where.branchId = { in: branchIds };
      }

      if (inputValue) {
        where = {
          ...where,
          OR: [
          { partNo: { partNumber: { contains: inputValue, mode: 'insensitive' } } },
          { partNo: { partName: { contains: inputValue, mode: 'insensitive' } } },
          { partNo: { displayName: { contains: inputValue, mode: 'insensitive' } } },
          { partNo: { partNumber: { contains: tCased, mode: 'insensitive' } } },
          { partNo: { partName: { contains: tCased, mode: 'insensitive' } } },
          { partNo: { displayName: { contains: tCased, mode: 'insensitive' } } },
          // Vehicle search logic
          {
            partNo: {
              vehicleSuit: {
                some: {
                  VehicleMaster: {
                    OR: [
                      { modelName: { contains: inputValue, mode: 'insensitive' } },
                      { modelCode: { contains: inputValue, mode: 'insensitive' } }
                    ]
                  }
                }
              }
            }
          }
        ]
      };
    }

      const [history, count] = await Promise.all([
        prisma.adjustSparesInventory.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.adjustInclude
        }),
        prisma.adjustSparesInventory.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "History fetched successfully",
          data: {
            count,
            history: history.map(h => this.formatAdjustment(h))
          }
        }
      });
    } catch (err) {
      logger.error("Get adjust spares inventory error:", err);
      return res.status(500).json({ code: 500, message: "Error fetching history", error: err.message });
    }
  };

  create = async (req, res) => {
    try {
      const { partNo, availableQuantity, newQuantity, reason, branch } = req.body;
      const userId = req.user?.id || req.headers["user-id"];
      const branchId = branch || req.user?.branch?.[0]; // Fallback to first branch in token

      if (!partNo || !branchId) {
        return res.status(400).json({ code: 400, message: "partNo and branch are required" });
      }

      const result = await prisma.$transaction(async (tx) => {
        // 1. Create adjustment record
        const adjustment = await tx.adjustSparesInventory.create({
          data: {
            availableQuantity: parseInt(availableQuantity) || 0,
            newQuantity: parseInt(newQuantity) || 0,
            reason: reason || "",
            createdAt: new Date(),
            partNo: { connect: { id: partNo } },
            branch: { connect: { id: branchId } },
            adjustByUser: userId ? { connect: { id: userId } } : undefined
          },
          include: this.adjustInclude
        });

        // 2. Update or Create SparesInventory
        const inventory = await tx.sparesInventory.findFirst({
          where: {
            partId: partNo,
            branchId: branchId
          }
        });

        if (inventory) {
          await tx.sparesInventory.update({
            where: { id: inventory.id },
            data: {
              phyQuantity: parseInt(newQuantity) || 0,
              accQuantity: parseInt(newQuantity) || 0
            }
          });
        } else {
          await tx.sparesInventory.create({
            data: {
              createdAt: new Date(),
              phyQuantity: parseInt(newQuantity) || 0,
              accQuantity: parseInt(newQuantity) || 0,
              partNo: { connect: { id: partNo } },
              branch: { connect: { id: branchId } }
            }
          });
        }

        return adjustment;
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Inventory adjusted successfully",
          data: this.formatAdjustment(result)
        }
      });
    } catch (err) {
      logger.error("Create adjust spares inventory error:", err);
      return res.status(500).json({ code: 500, message: "Error adjusting inventory", error: err.message });
    }
  };

  delete = async (req, res) => {
    try {
      const { id } = req.params;

      const result = await prisma.$transaction(async (tx) => {
        // 1. Get adjustment record
        const adjustment = await tx.adjustSparesInventory.findUnique({
          where: { id },
          include: { partNo: true, branch: true }
        });

        if (!adjustment) {
          throw new Error("Adjustment record not found");
        }

        // 2. Revert quantity in SparesInventory
        const inventory = await tx.sparesInventory.findFirst({
          where: {
            partId: adjustment.partId,
            branchId: adjustment.branchId
          }
        });

        if (inventory) {
          await tx.sparesInventory.update({
            where: { id: inventory.id },
            data: {
              phyQuantity: adjustment.availableQuantity,
              accQuantity: adjustment.availableQuantity
            }
          });
        }

        // 3. Delete adjustment record
        await tx.adjustSparesInventory.delete({
          where: { id }
        });

        return true;
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Adjustment reverted to original quantity and record deleted"
        }
      });
    } catch (err) {
      logger.error("Delete adjust spares inventory error:", err);
      return res.status(500).json({ code: 500, message: err.message || "Error deleting adjustment" });
    }
  };
}

export default new AdjustSparesInventoryController();

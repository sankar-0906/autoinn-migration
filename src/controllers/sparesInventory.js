import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Spares Inventory operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class SparesInventoryController {
  // Shared include object for SparesInventory
  inventoryInclude = {
    partNo: {
      include: {
        manufacturer: true,
        hsn: true,
        vehicleSuit: {
          include: {
            VehicleMaster: true
          }
        }
      }
    },
    branch: {
      include: {
        manufacturer: true
      }
    }
  };

  // Shared include object for Transactions
  transactionInclude = {
    Part: {
      include: {
        manufacturer: true,
        hsn: true,
        vehicleSuit: {
          include: {
            VehicleMaster: true
          }
        }
      }
    },
    sparesPurchase: {
      include: {
        supplier: true,
        PurchaseSpareInvoiceItem: {
          include: {
            branch: true
          }
        }
      }
    },
    sparesSale: {
      include: {
        jobOrder: {
          include: {
            customer: true,
            vehicle: {
              include: {
                vehicleMaster: true
              }
            }
          }
        },
        partyName: true,
        branch: true
      }
    },
    sparesMaterialSale: {
      include: {
        job: {
          include: {
            customer: true,
            vehicle: {
              include: {
                vehicleMaster: true
              }
            }
          }
        },
        branch: true
      }
    }
  };

  /**
   * Helper to format PartsMaster to match legacy 'vehicle' structure
   */
  formatPart = (p) => {
    if (!p) return p;
    return {
      ...p,
      vehicleSuit: (p.vehicleSuit || []).map(suit => ({
        ...suit,
        vehicle: suit.VehicleMaster || null
      }))
    };
  };

  /**
   * Helper to format SparesInventory
   */
  formatInventory = (inv) => {
    if (!inv) return inv;
    return {
      ...inv,
      partNo: this.formatPart(inv.partNo)
    };
  };

  /**
   * Helper to format Transactions
   */
  formatTransaction = (t) => {
    if (!t) return t;
    const formatted = {
      ...t,
      Part: this.formatPart(t.Part)
    };

    if (formatted.sparesPurchase) {
      formatted.sparesPurchase = {
        ...formatted.sparesPurchase,
        purchaseItemInvoice: formatted.sparesPurchase.PurchaseSpareInvoiceItem || []
      };
      delete formatted.sparesPurchase.PurchaseSpareInvoiceItem;
    }

    return formatted;
  };

  createSparesInventory = async (req, res) => {
    try {
      const { part, branch } = req.body;
      const user = req.user?.id || req.headers["user-id"];
      
      console.log("Add Spares Inventory Data", req.body);
      
      let results = [];
      for (const item of branch) {
        // Legacy logic: upsert by branch and part
        const existing = await prisma.sparesInventory.findFirst({
          where: {
            branchId: item.branch,
            partId: part.id
          }
        });

        if (existing) {
          const updated = await prisma.sparesInventory.update({
            where: { id: existing.id },
            data: {
              phyQuantity: item.phyQuantity ? Math.max(0, parseInt(item.phyQuantity)) : 0,
              accQuantity: item.accQuantity ? Math.max(0, parseInt(item.accQuantity)) : 0,
              binNum: item.binNum || ""
            },
            include: this.inventoryInclude
          });
          results.push(this.formatInventory(updated));
        } else {
          const created = await prisma.sparesInventory.create({
            data: {
              createdAt: new Date(),
              phyQuantity: item.phyQuantity ? Math.max(0, parseInt(item.phyQuantity)) : 0,
              accQuantity: item.accQuantity ? Math.max(0, parseInt(item.accQuantity)) : 0,
              binNum: item.binNum || "",
              partNo: { connect: { id: part.id } },
              branch: { connect: { id: item.branch } }
            },
            include: this.inventoryInclude
          });
          results.push(this.formatInventory(created));
        }
      }

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Spares Inventory processed",
          data: results[0] // Legacy returns first one if multiple
        }
      });
    } catch (err) {
      logger.error("Create spares inventory error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  updateSparesInventory = async (req, res) => {
    try {
      const { id } = req.params;
      const { binNum, minStock, maxStock, reorderLevel, reorderQuantity, phyQuantity, accQuantity } = req.body;

      const updated = await prisma.sparesInventory.update({
        where: { id },
        data: {
          binNum,
          minStock: parseInt(minStock) || 0,
          maxStock: parseInt(maxStock) || 0,
          reorderLevel: parseInt(reorderLevel) || 0,
          reorderQuantity: parseInt(reorderQuantity) || 0,
          phyQuantity: parseInt(phyQuantity) || 0,
          accQuantity: parseInt(accQuantity) || 0
        },
        include: this.inventoryInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Spares Inventory updated",
          data: this.formatInventory(updated)
        }
      });
    } catch (err) {
      logger.error("Update spares inventory error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  deleteSparesInventory = async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.sparesInventory.delete({ where: { id } });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "SparesInventory deleted permanently."
        }
      });
    } catch (err) {
      logger.error("Delete spares inventory error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const inventory = await prisma.sparesInventory.findUnique({
        where: { id },
        include: this.inventoryInclude
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "SparesInventory fetched",
          data: this.formatInventory(inventory)
        }
      });
    } catch (err) {
      logger.error("Get one spares inventory error:", err);
      return res.json({ code: 500, message: "Server error" });
    }
  };

  getAll = async (req, res) => {
    try {
      const inventories = await prisma.sparesInventory.findMany({
        include: this.inventoryInclude
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "inventories fetched",
          data: inventories.map(i => this.formatInventory(i))
        }
      });
    } catch (err) {
      logger.error("Get all spares inventory error:", err);
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
        code: 201, // Legacy returns 201 for this post
        response: {
          code: 200,
          message: "inventories fetched",
          data: inventories.map(i => this.formatInventory(i))
        }
      });
    } catch (err) {
      logger.error("Get spares by branch error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  getSparePart = async (req, res) => {
    try {
      const { id } = req.params; // This is the Part ID
      const inventories = await prisma.sparesInventory.findMany({
        where: {
          partId: id,
          phyQuantity: { gt: 0 }
        },
        include: this.inventoryInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "SparesInventory fetched",
          data: inventories.map(i => this.formatInventory(i))
        }
      });
    } catch (err) {
      logger.error("Get spare part inventory error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getSparesHistory = async (req, res) => {
    try {
      const { id } = req.params; // Part ID
      const transactions = await prisma.transactions.findMany({
        where: { partId: id },
        orderBy: { createdAt: 'desc' },
        include: this.transactionInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "SparesInventory History fetched",
          data: transactions.map(t => this.formatTransaction(t)),
          // Legacy parity: Provide data at root level of response if needed
          Transcations: transactions.map(t => this.formatTransaction(t))
        },
        // Root level for direct legacy compatibility
        message: "SparesInventory History fetched",
        data: transactions.map(t => this.formatTransaction(t))
      });
    } catch (err) {
      logger.error("Get spares history error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };



  getAllBranch = async (req, res) => {
    try {
      const branches = await prisma.branch.findMany({
        include: {
          manufacturer: true
        }
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "branch fetched",
          data: branches
        }
      });
    } catch (err) {
      logger.error("Get all branches error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString } = req.body;
      const branchIds = req.user?.branch || [];
      const parsedPage = parseInt(page) || 1;
      const parsedSize = parseInt(size) || 10;
      const skip = (parsedPage - 1) * parsedSize;
      const inputValue = searchString || "";
      const tCased = await titleCase(inputValue);

      const where = {
        branchId: { in: Array.isArray(branchIds) ? branchIds : [branchIds] },
        partNo: {
          OR: [
            { partName: { contains: inputValue, mode: 'insensitive' } },
            { partName: { contains: tCased, mode: 'insensitive' } },
            { partNumber: { contains: inputValue, mode: 'insensitive' } }
          ]
        }
      };

      const [inventories, count, allInventory] = await Promise.all([
        prisma.sparesInventory.findMany({
          where,
          take: parsedSize,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.inventoryInclude
        }),
        prisma.sparesInventory.count({ where }),
        // Fetch all matching inventory for total cost calculation (legacy behavior)
        prisma.sparesInventory.findMany({
          where,
          include: { partNo: true }
        })
      ]);

      const total = allInventory.reduce((acc, item) => {
        const mrp = parseFloat(item.partNo?.mrp) || 0;
        return acc + (item.phyQuantity * mrp);
      }, 0);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Spares Inventories  fetched",
          data: { 
            count, 
            sparesInventory: inventories.map(i => this.formatInventory(i)),
            total: Number(total.toFixed(2))
          }
        }
      });
    } catch (err) {
      logger.error("Get spares inventory page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  getByBranch = async (req, res) => {
    try {
      const { page, size, searchString, branch } = req.body;
      const userBranch = branch || req.user?.branch || [];
      const branchIds = Array.isArray(userBranch) ? userBranch : [userBranch];
      const parsedPage = parseInt(page) || 1;
      const parsedSize = parseInt(size) || 10;
      const skip = (parsedPage - 1) * parsedSize;
      const inputValue = searchString || "";
      const tCased = await titleCase(inputValue);

      const where = {
        branchId: { in: branchIds },
        phyQuantity: { gt: 0 },
        partNo: {
          OR: [
            { partName: { contains: inputValue, mode: 'insensitive' } },
            { partName: { contains: tCased, mode: 'insensitive' } },
            { partNumber: { contains: inputValue, mode: 'insensitive' } }
          ]
        }
      };

      const inventories = await prisma.sparesInventory.findMany({
        where,
        take: parsedSize,
        skip,
        orderBy: { createdAt: 'desc' },
        include: this.inventoryInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "sparesInventories fetched",
          data: inventories.map(i => this.formatInventory(i))
        }
      });
    } catch (err) {
      logger.error("Get by branch error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  bulkUpdate = async (req, res) => {
    try {
      const { updatedSpares } = req.body;
      let lastUpdated;

      for (const spare of updatedSpares) {
        lastUpdated = await prisma.sparesInventory.update({
          where: { id: spare.id },
          data: {
            phyQuantity: parseInt(spare.phyQuantity) || 0,
            accQuantity: parseInt(spare.accQuantity) || 0,
            updatedAt: new Date()
          },
          include: this.inventoryInclude
        });
      }

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Bulk Spares updated",
          data: this.formatInventory(lastUpdated)
        }
      });
    } catch (err) {
      logger.error("Bulk update error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  getPart = async (req, res) => {
    try {
      const { branch, skipNull = true, partNo } = req.body;
      const inputValue = partNo || "";

      const where = {
        phyQuantity: skipNull ? { gt: 0 } : undefined
      };

      if (partNo) {
        where.partId = partNo;
      }

      if (branch) {
        where.branchId = { in: Array.isArray(branch) ? branch : [branch] };
      }

      const inventories = await prisma.sparesInventory.findMany({
        where,
        include: this.inventoryInclude
      });

      const formattedInventories = inventories.map(i => this.formatInventory(i));

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "sparesInventories fetched",
          data: { 
            sparesInventory: formattedInventories,
            SparesInventory: formattedInventories
          }
        },
        // Legacy parity
        data: formattedInventories,
        sparesInventory: formattedInventories
      });
    } catch (err) {
      logger.error("Get part error:", err);
      return res.json({ code: 500, message: "error getting SparesInventory" });
    }
  };
}

export default new SparesInventoryController();

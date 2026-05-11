import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";
import { normalizeBranchIds } from "../utils/branch.util.js";

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
            branch: true,
            partNumber: {
              include: {
                manufacturer: true,
                hsn: true
              }
            }
          }
        },
        branch: true
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
        branch: true,
        SaleSpareInvoiceItem: {
          include: {
            partNumber: {
              include: {
                manufacturer: true,
                hsn: true
              }
            },
            hsn: true,
            branch: true
          }
        }
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
        branch: true,
        MaterialPartsIssue: {
          include: {
            part: {
              include: {
                manufacturer: true,
                hsn: true
              }
            },
            branch: true
          }
        }
      }
    },
    branch: true
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
        purchaseItemInvoice: (formatted.sparesPurchase.PurchaseSpareInvoiceItem || []).map(item => ({
          ...item,
          partNumber: this.formatPart(item.partNumber)
        }))
      };
      formatted.linkObj = {
        id: formatted.sparesPurchase.invoiceNumber,
        link: `/purchase-spare-invoice/view/${formatted.sparesPurchase.id}`
      };
      delete formatted.sparesPurchase.PurchaseSpareInvoiceItem;
    }

    if (formatted.sparesSale) {
      formatted.sparesSale = {
        ...formatted.sparesSale,
        saleItemInvoice: (formatted.sparesSale.SaleSpareInvoiceItem || []).map(item => ({
          ...item,
          partNumber: this.formatPart(item.partNumber)
        }))
      };
      formatted.linkObj = {
        id: formatted.sparesSale.invoiceNumber,
        link: `/sale-spare-invoice/view/${formatted.sparesSale.id}`
      };
      delete formatted.sparesSale.SaleSpareInvoiceItem;
    }

    if (formatted.sparesMaterialSale) {
      formatted.sparesMaterialSale = {
        ...formatted.sparesMaterialSale,
        parts: (formatted.sparesMaterialSale.MaterialPartsIssue || []).map(item => ({
          ...item,
          part: this.formatPart(item.part)
        }))
      };
      formatted.linkObj = {
        id: formatted.sparesMaterialSale.slipNumber,
        link: `/material-issue/view/${formatted.sparesMaterialSale.id}`
      };
      delete formatted.sparesMaterialSale.MaterialPartsIssue;
    }

    // Fallback for manual adjustments
    if (!formatted.linkObj) {
      formatted.linkObj = {
        id: "-",
        link: "#"
      };
    }

    return formatted;
  };

  createSparesInventory = async (req, res) => {
    try {
      const { part, branch } = req.body;
      const user = req.user?.id || req.headers["user-id"];
      
      console.log("Add Spares Inventory Data", req.body);
      
      let partId = part.id;
      if (!partId && part.partNumber) {
        const foundPart = await prisma.partsMaster.findFirst({
          where: { partNumber: part.partNumber }
        });
        if (foundPart) partId = foundPart.id;
      }

      if (!partId) {
        return res.json({
          code: 400,
          message: "Part not found. Please create the part in Parts Master first.",
          response: {
            code: 400,
            message: "Part not found."
          }
        });
      }

      const results = await prisma.$transaction(async (tx) => {
        let items = [];
        for (const item of branch) {
          const existing = await tx.sparesInventory.findFirst({
            where: {
              branchId: item.branch,
              partId: partId
            }
          });

          if (existing) {
            const oldPhy = existing.phyQuantity || 0;
            const newPhy = item.phyQuantity ? Math.max(0, parseInt(item.phyQuantity)) : 0;
            const diffPhy = newPhy - oldPhy;

            const oldAcc = existing.accQuantity || 0;
            const newAcc = item.accQuantity ? Math.max(0, parseInt(item.accQuantity)) : 0;
            const diffAcc = newAcc - oldAcc;

            const updated = await tx.sparesInventory.update({
              where: { id: existing.id },
              data: {
                phyQuantity: newPhy,
                accQuantity: newAcc,
                binNum: item.binNum || ""
              },
              include: this.inventoryInclude
            });

            // Create separate transactions if deltas are different
            if (diffPhy !== 0) {
              await tx.transactions.create({
                data: {
                  createdAt: new Date(),
                  type: "Physical Inventory Correction",
                  Quantity: Math.abs(diffPhy),
                  status: diffPhy > 0 ? "ADD" : "SUB",
                  color: diffPhy > 0 ? "green" : "red",
                  branch: { connect: { id: item.branch } },
                  Part: { connect: { id: partId } }
                }
              });
            }
            if (diffAcc !== 0) {
              await tx.transactions.create({
                data: {
                  createdAt: new Date(),
                  type: "Accounting Inventory Correction",
                  Quantity: Math.abs(diffAcc),
                  status: diffAcc > 0 ? "ADD" : "SUB",
                  color: diffAcc > 0 ? "green" : "red",
                  branch: { connect: { id: item.branch } },
                  Part: { connect: { id: partId } }
                }
              });
            }

            items.push(this.formatInventory(updated));
          } else {
            const phy = item.phyQuantity ? Math.max(0, parseInt(item.phyQuantity)) : 0;
            const acc = item.accQuantity ? Math.max(0, parseInt(item.accQuantity)) : 0;
            
            const created = await tx.sparesInventory.create({
              data: {
                createdAt: new Date(),
                phyQuantity: phy,
                accQuantity: acc,
                binNum: item.binNum || "",
                partNo: { connect: { id: partId } },
                branch: { connect: { id: item.branch } }
              },
              include: this.inventoryInclude
            });

            // Create Transaction for new inventory
            await tx.transactions.create({
              data: {
                createdAt: new Date(),
                type: "Opening Stock",
                Quantity: phy,
                color: "green",
                branch: { connect: { id: item.branch } },
                Part: { connect: { id: partId } }
              }
            });

            items.push(this.formatInventory(created));
          }
        }
        return items;
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Spares Inventory processed",
          data: results[0]
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

      const updated = await prisma.$transaction(async (tx) => {
        const existing = await tx.sparesInventory.findUnique({
          where: { id }
        });

        if (!existing) throw new Error("Inventory record not found");

        const oldPhy = existing.phyQuantity || 0;
        const newPhy = parseInt(phyQuantity);
        const diffPhy = newPhy - oldPhy;

        const oldAcc = existing.accQuantity || 0;
        const newAcc = parseInt(accQuantity);
        const diffAcc = newAcc - oldAcc;

        const result = await tx.sparesInventory.update({
          where: { id },
          data: {
            binNum,
            minStock: parseInt(minStock) || 0,
            maxStock: parseInt(maxStock) || 0,
            reorderLevel: parseInt(reorderLevel) || 0,
            reorderQuantity: parseInt(reorderQuantity) || 0,
            phyQuantity: newPhy,
            accQuantity: newAcc
          },
          include: this.inventoryInclude
        });

        if (diffPhy !== 0) {
          await tx.transactions.create({
            data: {
              createdAt: new Date(),
              type: "Physical Inventory Correction",
              Quantity: Math.abs(diffPhy),
              status: diffPhy > 0 ? "ADD" : "SUB",
              color: diffPhy > 0 ? "green" : "red",
              branch: { connect: { id: existing.branchId } },
              Part: { connect: { id: existing.partId } }
            }
          });
        }
        if (diffAcc !== 0) {
          await tx.transactions.create({
            data: {
              createdAt: new Date(),
              type: "Accounting Inventory Correction",
              Quantity: Math.abs(diffAcc),
              status: diffAcc > 0 ? "ADD" : "SUB",
              color: diffAcc > 0 ? "green" : "red",
              branch: { connect: { id: existing.branchId } },
              Part: { connect: { id: existing.partId } }
            }
          });
        }

        return result;
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
      return res.json({ code: 500, msg: "An error occured", error: err.message });
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
      const { page, size, searchString, branch } = req.body;
      const branchIds = normalizeBranchIds(branch, req.user?.branch);
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
      const branchIds = normalizeBranchIds(branch, req.user?.branch);
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

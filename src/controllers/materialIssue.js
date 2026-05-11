import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";

/**
 * Controller for Material Issue (Parts issued to Job Orders).
 */
class MaterialIssueController {
  getPage = async (req, res) => {
    try {
      const { page = 1, size = 10 } = req.body;
      const skip = (parseInt(page) - 1) * parseInt(size);
      const take = parseInt(size);

      const [materials, count] = await Promise.all([
        prisma.materialIssue.findMany({
          skip,
          take,
          include: {
            job: {
              include: {
                customer: { select: { name: true } },
                vehicle: { select: { registerNo: true } }
              }
            },
            mechanic: { select: { EmployeeProfile_User_profileToEmployeeProfile: { select: { employeeName: true } } } },
            MaterialPartsIssue: {
              include: { part: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.materialIssue.count()
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          data: materials.map(m => this.formatMaterialIssue(m)),
          count
        }
      });
    } catch (err) {
      logger.error("Material issue getPage error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const material = await prisma.materialIssue.findUnique({
        where: { id },
        include: {
          job: true,
          MaterialPartsIssue: {
            include: { part: true }
          }
        }
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          data: this.formatMaterialIssue(material)
        }
      });
    } catch (err) {
      logger.error("Material issue getOne error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getMaxSlipNumber = async (req, res) => {
    try {
      const { materialIssueId } = req.params;
      const result = await prisma.materialPartsIssue.aggregate({
        where: {
          MaterialIssue: { some: { id: materialIssueId } }
        },
        _max: {
          slipNumber: true
        }
      });
      return res.json({
        code: 200,
        response: result._max.slipNumber || 0
      });
    } catch (err) {
      logger.error("Material issue getMaxSlipNumber error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  formatMaterialIssue = (m) => {
    if (!m) return m;
    const formatted = { ...m };
    if (formatted.MaterialPartsIssue) {
      formatted.parts = formatted.MaterialPartsIssue.map(p => ({
        ...p,
        part: p.part || null
      }));
      delete formatted.MaterialPartsIssue;
    }
    return formatted;
  };

  getJobMaterial = async (req, res) => {
    try {
      const { id } = req.params; // JobOrder ID
      const branchIds = req.user?.branch || [];
      const branchArr = Array.isArray(branchIds) ? branchIds : [branchIds];

      const materials = await prisma.materialIssue.findMany({
        where: {
          jobOrderId: id,
          branchId: { in: branchArr }
        },
        include: {
          job: {
            include: {
              customer: true,
              vehicle: { include: { vehicleMaster: true } }
            }
          },
          mechanic: true,
          MaterialPartsIssue: {
            include: { 
              part: {
                 include: { manufacturer: true }
              },
              branch: true,
              mechanic: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          data: materials.map(m => this.formatMaterialIssue(m))
        }
      });
    } catch (err) {
      logger.error("Get job material error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  importFromEstimate = async (req, res) => {
    try {
      const { jobOrderNo } = req.params;
      const branchIds = req.user?.branch || [];
      const branchArr = Array.isArray(branchIds) ? branchIds : [branchIds];

      const jobOrder = await prisma.jobOrder.findFirst({
        where: { id: jobOrderNo, branchId: { in: branchArr } }
      });

      if (!jobOrder) {
        return res.json({ code: 404, message: "Job order not found" });
      }

      const latestEstimate = await prisma.estimate.findFirst({
        where: { jobOrderId: jobOrderNo, estimateStatus: "APPROVED" },
        orderBy: { createdAt: 'desc' },
        include: {
          EstimateItemInvoice: {
            where: { status: "APPROVED" },
            include: { partNumber: { include: { manufacturer: true } } }
          }
        }
      });

      if (!latestEstimate) {
        return res.json({ code: 404, message: "No approved estimate found" });
      }

      const availableParts = [];
      const unavailableParts = [];

      for (const item of latestEstimate.EstimateItemInvoice) {
        if (!item.partNumber) continue;

        const inventory = await prisma.sparesInventory.findFirst({
          where: { partNoId: item.partNumber.id, branchId: jobOrder.branchId }
        });

        const phyQty = inventory ? parseFloat(inventory.physicalQuantity || 0) : 0;
        const requestedQty = parseFloat(item.quantity || 0);

        const partData = {
          id: item.id,
          partNumber: item.partNumber,
          quantity: item.quantity,
          unitRate: item.unitRate
        };

        if (phyQty >= requestedQty) {
          availableParts.push({ ...partData, available: true });
        } else {
          unavailableParts.push({ ...partData, available: false, availableQuantity: phyQty });
        }
      }

      return res.json({
        code: 200,
        message: "Parts retrieved from estimate",
        data: {
          jobOrderId: jobOrder.id,
          estimateId: latestEstimate.id,
          totalParts: latestEstimate.EstimateItemInvoice.length,
          availableCount: availableParts.length,
          availableParts,
          unavailableParts
        }
      });
    } catch (err) {
      logger.error("Import from estimate error:", err);
      return res.json({ code: 500, message: "Server error", error: err.toString() });
    }
  };

  importFromEstimateCso = async (req, res) => {
    try {
      const { jobOrderNo } = req.params;
      const branchIds = req.user?.branch || [];
      const branchArr = Array.isArray(branchIds) ? branchIds : [branchIds];

      const jobOrder = await prisma.jobOrder.findFirst({
        where: { id: jobOrderNo, branchId: { in: branchArr } }
      });

      if (!jobOrder) {
        return res.json({ code: 404, message: "Job order not found" });
      }

      const latestEstimate = await prisma.estimate.findFirst({
        where: { jobOrderId: jobOrderNo, estimateStatus: "APPROVED" },
        orderBy: { createdAt: 'desc' },
        include: {
          EstimateItemInvoice: {
            where: { status: "APPROVED" },
            include: { partNumber: { include: { manufacturer: true } } }
          }
        }
      });

      if (!latestEstimate) {
        return res.json({ code: 404, message: "No approved estimate found" });
      }

      const availableParts = latestEstimate.EstimateItemInvoice.map(item => ({
        id: item.id,
        partNumber: item.partNumber,
        quantity: item.quantity,
        unitRate: item.unitRate,
        available: true
      }));

      return res.json({
        code: 200,
        message: "Parts retrieved from estimate",
        data: {
          jobOrderId: jobOrder.id,
          estimateId: latestEstimate.id,
          totalParts: latestEstimate.EstimateItemInvoice.length,
          availableCount: availableParts.length,
          availableParts
        }
      });
    } catch (err) {
      logger.error("Import from estimate CSO error:", err);
      return res.json({ code: 500, message: "Server error", error: err.toString() });
    }
  };
}

export default new MaterialIssueController();

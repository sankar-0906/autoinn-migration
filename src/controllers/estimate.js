import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Service Estimate operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class EstimateController {
  // Shared include object for Estimate
  estimateInclude = {
    jobOrder: {
      include: {
        customer: true,
        vehicle: { include: { vehicle: true } },
        branch: true
      }
    },
    estimateItemInvoice: {
      include: {
        partNumber: true,
        hsn: true
      }
    },
    estimateJobInvoice: {
      include: {
        jobCode: true,
        sac: true
      }
    }
  };

  createEstimate = async (req, res) => {
    try {
      const {
        estimateNo, jobOrder, dateTime, estimateStatus,
        itemRate, discountType, discountPercent, discountRate,
        tcs, cgst, sgst, igst, totalDiscount, adjustment, totalInvoice,
        estimateItemInvoice, estimateJobInvoice
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.estimateInvoice.create({
        data: {
          estimateNo,
          dateTime: dateTime ? new Date(dateTime) : new Date(),
          estimateStatus: estimateStatus || "PENDING",
          itemRate: parseFloat(itemRate) || 0,
          discountType,
          discountPercent: parseFloat(discountPercent) || 0,
          discountRate: parseFloat(discountRate) || 0,
          tcs: parseFloat(tcs) || 0,
          cgst: parseFloat(cgst) || 0,
          sgst: parseFloat(sgst) || 0,
          igst: parseFloat(igst) || 0,
          totalDiscount: parseFloat(totalDiscount) || 0,
          adjustment: parseFloat(adjustment) || 0,
          totalInvoice: parseFloat(totalInvoice) || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          jobOrder: jobOrder ? { connect: { id: jobOrder } } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined,
          estimateItemInvoice: estimateItemInvoice && estimateItemInvoice.length > 0 ? {
            create: estimateItemInvoice.map(item => ({
              partNumber: { connect: { id: item.partNumber } },
              partName: item.partName,
              quantity: parseFloat(item.quantity) || 0,
              unitRate: parseFloat(item.unitRate) || 0,
              gstRate: parseFloat(item.gstRate) || 0,
              igst: parseFloat(item.igst) || 0,
              cgst: parseFloat(item.cgst) || 0,
              sgst: parseFloat(item.sgst) || 0,
              igstAmount: parseFloat(item.igstAmount) || 0,
              cgstAmount: parseFloat(item.cgstAmount) || 0,
              sgstAmount: parseFloat(item.sgstAmount) || 0,
              discountAmount: parseFloat(item.discountAmount) || 0,
              hsn: item.hsn ? { connect: { id: item.hsn } } : undefined,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          } : undefined,
          estimateJobInvoice: estimateJobInvoice && estimateJobInvoice.length > 0 ? {
            create: estimateJobInvoice.map(job => ({
              jobCode: { connect: { id: job.jobCode } },
              jobDescription: job.jobDescription,
              labourRate: parseFloat(job.labourRate) || 0,
              gstRate: parseFloat(job.gstRate) || 0,
              igst: parseFloat(job.igst) || 0,
              cgst: parseFloat(job.cgst) || 0,
              sgst: parseFloat(job.sgst) || 0,
              igstAmount: parseFloat(job.igstAmount) || 0,
              cgstAmount: parseFloat(job.cgstAmount) || 0,
              sgstAmount: parseFloat(job.sgstAmount) || 0,
              discountAmount: parseFloat(job.discountAmount) || 0,
              sac: job.sac ? { connect: { id: job.sac } } : undefined,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          } : undefined
        },
        include: this.estimateInclude
      });

      return res.json({
        code: 200,
        response: created
      });
    } catch (err) {
      logger.error("Create estimate error:", err);
      return res.json({ code: 500, msg: "An error occured", err });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const estimate = await prisma.estimateInvoice.findUnique({
        where: { id },
        include: this.estimateInclude
      });

      if (estimate) {
        return res.json({
          code: 200,
          response: estimate
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one estimate error:", err);
      return res.json({ code: 500, message: "Server error" });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString } = req.body;
      const skip = (page - 1) * size;
      const inputValue = searchString || "";

      const where = {
        OR: [
          { estimateNo: { contains: inputValue, mode: 'insensitive' } },
          { jobOrder: { jobNo: { contains: inputValue, mode: 'insensitive' } } },
          { jobOrder: { customerPhone: { contains: inputValue, mode: 'insensitive' } } }
        ]
      };

      const [estimates, count] = await Promise.all([
        prisma.estimateInvoice.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.estimateInclude
        }),
        prisma.estimateInvoice.count({ where })
      ]);

      return res.json({
        code: 200,
        response: { count, estimate: estimates }
      });
    } catch (err) {
      logger.error("Get estimate page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };
}

export default new EstimateController();

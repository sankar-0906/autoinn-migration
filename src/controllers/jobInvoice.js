import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

import IdGenerateController from "./idGenerate.js";

/**
 * Controller for Job Invoice operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class JobInvoiceController {
  // Shared include object for JobInvoice
  invoiceInclude = {
    jobOrder: {
      include: {
        customer: true,
        vehicle: { include: { vehicle: true } },
        branch: true
      }
    },
    saleSpareInvoice: {
      include: {
        partNumber: true,
        hsn: true,
        branch: true
      }
    },
    saleJobInvoice: {
      include: {
        jobCode: true,
        sac: true
      }
    }
  };

  createJobInvoice = async (req, res) => {
    try {
      const {
        invoiceNumber, invoiceDate, jobOrder, itemRate,
        discountType, discountPercent, discountRate, tcs,
        cgst, sgst, igst, totalDiscount, adjustment, totalInvoice,
        saleSpareInvoice, saleJobInvoice
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.jobInvoice.create({
        data: {
          invoiceNumber,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
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
          saleSpareInvoice: saleSpareInvoice && saleSpareInvoice.length > 0 ? {
            create: saleSpareInvoice.map(item => ({
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
              branch: item.branch ? { connect: { id: item.branch } } : undefined,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          } : undefined,
          saleJobInvoice: saleJobInvoice && saleJobInvoice.length > 0 ? {
            create: saleJobInvoice.map(job => ({
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
        include: this.invoiceInclude
      });

      // Increment ID counter
      let branchId = null;
      if (jobOrder) {
          const jo = await prisma.jobOrder.findUnique({ where: { id: jobOrder }, select: { branchId: true } });
          branchId = jo?.branchId;
      }
      await IdGenerateController.incrementId("JOBINVOICE", branchId);

      return res.json({
        code: 200,
        response: created
      });
    } catch (err) {
      logger.error("Create job invoice error:", err);
      return res.json({ code: 500, msg: "An error occured", err });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await prisma.jobInvoice.findUnique({
        where: { id },
        include: this.invoiceInclude
      });

      if (invoice) {
        return res.json({
          code: 200,
          response: invoice
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one job invoice error:", err);
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
          { invoiceNumber: { contains: inputValue, mode: 'insensitive' } },
          { jobOrder: { jobNo: { contains: inputValue, mode: 'insensitive' } } },
          { jobOrder: { customerPhone: { contains: inputValue, mode: 'insensitive' } } }
        ]
      };

      const [invoices, count] = await Promise.all([
        prisma.jobInvoice.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.invoiceInclude
        }),
        prisma.jobInvoice.count({ where })
      ]);

      return res.json({
        code: 200,
        response: { count, jobInvoice: invoices }
      });
    } catch (err) {
      logger.error("Get job invoice page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };
}

export default new JobInvoiceController();

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
    JobOrder: {
      include: {
        customer: true,
        vehicle: { include: { vehicleMaster: true } },
        branch: true
      }
    },
    parts: {
      include: {
        MaterialPartsIssue: {
          include: {
            part: true
          }
        }
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
          invoiceNo: invoiceNumber,
          createdAt: new Date(),
          updatedAt: new Date(),
          JobOrder: jobOrder ? { connect: { id: jobOrder } } : undefined,
          User: user ? { connect: { id: user } } : undefined,
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
        response: {
          code: 200,
          message: "Job invoice created successfully",
          data: created
        }
      });
    } catch (err) {
      logger.error("Create job invoice error:", err);
      return res.json({ code: 500, response: { code: 500, message: "An error occured", data: err } });
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
          response: {
            code: 200,
            message: "job invoice fetched",
            data: invoice
          }
        });
      }
      return res.json({
        code: 404,
        response: {
          code: 404,
          message: "Not found",
          data: null
        }
      });
    } catch (err) {
      logger.error("Get one job invoice error:", err);
      return res.json({ code: 500, response: { code: 500, message: "Server error" } });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString } = req.body;
      const skip = (page - 1) * size;
      const inputValue = searchString || "";

      const where = {
        OR: [
          { invoiceNo: { contains: inputValue, mode: 'insensitive' } },
          { JobOrder: { jobNo: { contains: inputValue, mode: 'insensitive' } } },
          { JobOrder: { customerPhone: { contains: inputValue, mode: 'insensitive' } } }
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
        response: {
          code: 200,
          message: "JobInvoices fetched",
          data: { count, jobInvoice: invoices }
        }
      });
    } catch (err) {
      logger.error("Get job invoice page error:", err);
      return res.json({ code: 500, response: { code: 500, message: "an error occurred" } });
    }
  };

  getJob = async (req, res) => {
    try {
      const { id } = req.params;
      const invoices = await prisma.jobInvoice.findMany({
        where: {
          JobOrder: { id }
        },
        include: this.invoiceInclude,
        orderBy: { createdAt: 'asc' }
      });

      if (invoices && invoices.length > 0) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "job invoice fetched",
            data: invoices[invoices.length - 1]
          }
        });
      }

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "No invoice found for this job order",
          data: null
        }
      });
    } catch (err) {
      logger.error("Get job invoice by job ID error:", err);
      return res.json({ code: 500, response: { code: 500, message: "Server error" } });
    }
  };
}

export default new JobInvoiceController();

import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

import IdGenerateController from "./idGenerate.js";

/**
 * Controller for Purchase Invoice operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class PurchaseInvoiceController {
  // Shared include object for PurchaseInvoice
  invoiceInclude = {
    purchaseChallan: {
      include: {
        supplier: true,
        branch: true,
        vehicleDetail: {
          include: {
            vehicle: true,
            color: true
          }
        }
      }
    },
    supplier: true,
    branch: true,
    items: {
      include: {
        vehicle: true,
        color: true
      }
    }
  };

  createPurchaseInvoice = async (req, res) => {
    try {
      const {
        date, invoiceNo, invoiceDate, supplierId, branchId,
        purchaseChallanId, amount, taxAmount, totalAmount, items
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.purchaseInvoice.create({
        data: {
          date: date ? new Date(date) : new Date(),
          invoiceNo,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : undefined,
          amount: parseFloat(amount) || 0,
          taxAmount: parseFloat(taxAmount) || 0,
          totalAmount: parseFloat(totalAmount) || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          supplier: supplierId ? { connect: { id: supplierId } } : undefined,
          branch: branchId ? { connect: { id: branchId } } : undefined,
          purchaseChallan: purchaseChallanId ? { connect: { id: purchaseChallanId } } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined,
          items: items && items.length > 0 ? {
            create: items.map(item => ({
              vehicle: { connect: { id: item.vehicleId } },
              chassisNo: item.chassisNo,
              engineNo: item.engineNo,
              amount: parseFloat(item.amount) || 0,
              color: item.colorId ? { connect: { id: item.colorId } } : undefined,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          } : undefined
        },
        include: this.invoiceInclude
      });

      // Increment ID counter
      await IdGenerateController.incrementId("VPI", branchId);

      return res.json({
        code: 200,
        response: created
      });
    } catch (err) {
      logger.error("Create purchase invoice error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await prisma.purchaseInvoice.findUnique({
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
      logger.error("Get one purchase invoice error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString } = req.body;
      const branchIds = req.user?.branch || [];
      const skip = (page - 1) * size;
      const inputValue = searchString || "";

      const where = {
        branchId: { in: Array.isArray(branchIds) ? branchIds : [branchIds] },
        OR: [
          { invoiceNo: { contains: inputValue, mode: 'insensitive' } },
          { supplier: { name: { contains: inputValue, mode: 'insensitive' } } }
        ]
      };

      const [invoices, count] = await Promise.all([
        prisma.purchaseInvoice.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.invoiceInclude
        }),
        prisma.purchaseInvoice.count({ where })
      ]);

      return res.json({
        code: 200,
        response: { count, purchaseInvoice: invoices }
      });
    } catch (err) {
      logger.error("Get purchase invoice page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  checkDuplicateInvoiceNo = async (req, res) => {
    try {
      const { invoiceNo, supplierId } = req.body;
      const existing = await prisma.purchaseInvoice.findFirst({
        where: { invoiceNo, supplierId }
      });

      return res.json({
        code: existing ? 400 : 200,
        message: existing ? "Duplicate Invoice Number" : "Invoice Number Available",
        data: existing ? true : false
      });
    } catch (err) {
      logger.error("Check duplicate invoice error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };
}

export default new PurchaseInvoiceController();

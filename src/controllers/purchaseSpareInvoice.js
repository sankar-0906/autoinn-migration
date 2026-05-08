import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

import IdGenerateController from "./idGenerate.js";

/**
 * Controller for Purchase Spare Invoice operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class PurchaseSpareInvoiceController {
  // Shared include object for PurchaseSpareInvoice
  invoiceInclude = {
    supplier: {
      include: {
        address: { include: { district: true, state: true, country: true } },
        contact: true,
        bank: true
      }
    },
    PurchaseSpareInvoiceItem: {
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
  };

  transformInvoice = (invoice) => {
    if (!invoice) return invoice;
    const transformed = { ...invoice };
    if (transformed.PurchaseSpareInvoiceItem) {
      transformed.purchaseItemInvoice = transformed.PurchaseSpareInvoiceItem;
      delete transformed.PurchaseSpareInvoiceItem;
    }
    return transformed;
  };

  createPurchaseSpareInvoice = async (req, res) => {
    try {
      const {
        invoiceNumber, invoiceDate, supplier, supplierName, itemRate, itemrate,
        discountType, discountPercent, discountRate, tcs,
        cgst, sgst, igst, totalDiscount, adjustment, totalInvoice,
        purchaseItemInvoice, psiNo, branch
      } = req.body;
      const finalSupplier = supplier || supplierName;
      const finalItemRate = itemRate || itemrate;
      const user = req.user?.id || req.headers["user-id"];
 
      if (!purchaseItemInvoice || !Array.isArray(purchaseItemInvoice) || purchaseItemInvoice.length === 0) {
        return res.json({
          code: 400,
          message: "Select at least one vehicle",
          response: {
            code: 400,
            message: "Select at least one vehicle"
          }
        });
      }

      const created = await prisma.purchaseSpareInvoice.create({
        data: {
          invoiceNumber,
          psiNo,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : undefined,
          currentDate: new Date(),
          itemRate: finalItemRate,
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
          supplier: finalSupplier ? { connect: { id: finalSupplier } } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined,
          PurchaseSpareInvoiceItem: purchaseItemInvoice && purchaseItemInvoice.length > 0 ? {
            create: purchaseItemInvoice.map(item => ({
              partNumber: { connect: { id: item.partNumber?.id || item.partNumber } },
              hsn: (item.hsn?.id || item.hsn) ? { connect: { id: item.hsn?.id || item.hsn } } : undefined,
              branch: (item.branch?.id || item.branch || branch) ? { connect: { id: item.branch?.id || item.branch || branch } } : undefined,
              partName: item.partName,
              quantity: parseFloat(item.quantity) || 0,
              unitRate: parseFloat(item.unitRate) || 0,
              igst: parseFloat(item.igst) || 0,
              cgst: parseFloat(item.cgst) || 0,
              sgst: parseFloat(item.sgst) || 0,
              gstRate: parseFloat(item.gstRate) || 0,
              igstAmount: parseFloat(item.igstAmount) || 0,
              cgstAmount: parseFloat(item.cgstAmount) || 0,
              sgstAmount: parseFloat(item.sgstAmount) || 0,
              discountAmount: parseFloat(item.discountAmount) || 0,
              discountPercent: parseFloat(item.discountPercent) || 0,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          } : undefined
        },
        include: this.invoiceInclude
      });

      // Increment ID counter
      await IdGenerateController.incrementId("PSI", req.body.branch);

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Purchase Spare Invoice created successfully",
          data: this.transformInvoice(created)
        }
      });
    } catch (err) {
      logger.error("Create purchase spare invoice error:", err);
      return res.json({ code: 500, msg: "an error occurred", error: err.message });
    }
  };

  updatePurchaseSpareInvoice = async (req, res) => {
    try {
      const { id } = req.params;
      const {
        invoiceNumber, invoiceDate, supplier, supplierName, itemRate, itemrate,
        discountType, discountPercent, discountRate, tcs,
        cgst, sgst, igst, totalDiscount, adjustment, totalInvoice,
        purchaseItemInvoice, psiNo, branch
      } = req.body;
      const finalSupplier = supplier || supplierName;
      const finalItemRate = itemRate || itemrate;
 
      if (!purchaseItemInvoice || !Array.isArray(purchaseItemInvoice) || purchaseItemInvoice.length === 0) {
        return res.json({
          code: 400,
          message: "Select at least one vehicle",
          response: {
            code: 400,
            message: "Select at least one vehicle"
          }
        });
      }

      // 1. Delete existing items
      await prisma.purchaseSpareInvoiceItem.deleteMany({
        where: { purchaseSpareInvoiceId: id }
      });

      // 2. Update the main invoice and recreate items
      const updated = await prisma.purchaseSpareInvoice.update({
        where: { id },
        data: {
          invoiceNumber,
          psiNo,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : undefined,
          itemRate: finalItemRate,
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
          supplierId: finalSupplier,
          PurchaseSpareInvoiceItem: purchaseItemInvoice ? {
            create: purchaseItemInvoice.map(item => {
              const partNumberId = item.partNumber?.id || (typeof item.partNumber === 'string' ? item.partNumber : null);
              const hsnId = item.hsn?.id || (typeof item.hsn === 'string' ? item.hsn : null);
              const branchId = item.branch?.id || (typeof item.branch === 'string' ? item.branch : (branch || null));
              
              return {
                partName: item.partName,
                quantity: parseFloat(item.quantity) || 0,
                unitRate: parseFloat(item.unitRate) || 0,
                igst: parseFloat(item.igst) || 0,
                cgst: parseFloat(item.cgst) || 0,
                sgst: parseFloat(item.sgst) || 0,
                gstRate: parseFloat(item.gstRate) || 0,
                igstAmount: parseFloat(item.igstAmount) || 0,
                cgstAmount: parseFloat(item.cgstAmount) || 0,
                sgstAmount: parseFloat(item.sgstAmount) || 0,
                discountAmount: parseFloat(item.discountAmount) || 0,
                discountPercent: parseFloat(item.discountPercent) || 0,
                partNumberId,
                hsnId,
                branchId,
                createdAt: new Date(),
                updatedAt: new Date()
              };
            })
          } : undefined
        },
        include: this.invoiceInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Purchase Spare Invoice updated successfully",
          data: this.transformInvoice(updated)
        }
      });
    } catch (err) {
      logger.error("Update purchase spare invoice error:", err);
      return res.json({ code: 500, msg: "an error occurred", error: err.message });
    }
  };

  deletePurchaseSpareInvoice = async (req, res) => {
    try {
      const { id } = req.params;
      
      await prisma.purchaseSpareInvoiceItem.deleteMany({
        where: { purchaseSpareInvoiceId: id }
      });

      await prisma.purchaseSpareInvoice.delete({
        where: { id }
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Purchase Spare Invoice deleted successfully"
        }
      });
    } catch (err) {
      logger.error("Delete purchase spare invoice error:", err);
      return res.json({ code: 500, msg: "an error occurred", error: err.message });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await prisma.purchaseSpareInvoice.findUnique({
        where: { id },
        include: this.invoiceInclude
      });

      if (invoice) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            data: this.transformInvoice(invoice)
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one purchase spare invoice error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
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
          { supplier: { name: { contains: inputValue, mode: 'insensitive' } } }
        ]
      };

      const [invoices, count] = await Promise.all([
        prisma.purchaseSpareInvoice.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.invoiceInclude
        }),
        prisma.purchaseSpareInvoice.count({ where })
      ]);

      return res.json({
        code: 200,
        response: { 
          code: 200,
          data: {
            count, 
            purchaseSpareInvoice: invoices.map(inv => this.transformInvoice(inv)) 
          }
        }
      });
    } catch (err) {
      logger.error("Get purchase spare invoice page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  checkDuplicateInvoiceNo = async (req, res) => {
    try {
      const { invoiceNumber, supplierId } = req.body;
      const existing = await prisma.purchaseSpareInvoice.findFirst({
        where: { invoiceNumber, supplierId }
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

export default new PurchaseSpareInvoiceController();

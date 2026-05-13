import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

import IdGenerateController from "./idGenerate.js";

/**
 * Controller for Sale Spare Invoice operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class SaleSpareInvoiceController {
  // Shared include object for SaleSpareInvoice
  invoiceInclude = {
    partyName: { // Fixed: relation name is partyName in SaleSpareInvoice model
      include: { CustomerPhone: true } // Fixed: CustomerPhone relation in Customer model
    },
    branch: {
      include: { manufacturer: true } // Lowercase in Branch model
    },
    SaleSpareInvoiceItem: { // Fixed: relation name matches model name in plural
      include: {
        partNumber: true,
        hsn: true,
        jobCode: true
      }
    },
    jobOrder: true
  };

  createSaleSpareInvoice = async (req, res) => {
    try {
      const {
        invoiceNumber, invoiceDate, customer, itemRate,
        discountType, discountPercent, discountRate, tcs,
        cgst, sgst, igst, totalDiscount, adjustment, totalInvoice,
        saleSpareItemInvoice, branch
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const result = await prisma.$transaction(async (tx) => {
        const created = await tx.saleSpareInvoice.create({
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
            partyName: customer ? { connect: { id: customer } } : undefined,
            createdBy: user ? { connect: { id: user } } : undefined,
            SaleSpareInvoiceItem: saleSpareItemInvoice && saleSpareItemInvoice.length > 0 ? {
              create: saleSpareItemInvoice.map(item => ({
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
            } : undefined
          },
          include: this.invoiceInclude
        });

        // Update Inventory and Create Transactions
        for (const item of (saleSpareItemInvoice || [])) {
          const partId = item.partNumber;
          const qty = parseFloat(item.quantity) || 0;
          const branchId = branch; // Use branch from body

          if (!partId) continue;

          // 1. Create Transaction record for History
          await tx.transactions.create({
            data: {
              createdAt: new Date(),
              type: "Sale Spare Invoice",
              Quantity: parseInt(qty),
              Part: { connect: { id: partId } },
              sparesSale: { connect: { id: created.id } }
            }
          });

          // 2. Decrement SparesInventory
          if (branchId) {
            await tx.sparesInventory.updateMany({
              where: { partId: partId, branchId: branchId },
              data: {
                phyQuantity: { decrement: parseInt(qty) },
                accQuantity: { decrement: parseInt(qty) }
              }
            });
          }
        }

        return created;
      });

      // Increment ID counter
      await IdGenerateController.incrementId("CUSTOMERSALESSPARE", req.body.branch);

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Sale Spare Invoice created successfully",
          data: result
        }
      });
    } catch (err) {
      logger.error("Create sale spare invoice error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await prisma.saleSpareInvoice.findUnique({
        where: { id },
        include: this.invoiceInclude
      });

      if (invoice) {
        // Fetch related payments manually since there's no direct relation in prisma
        const payments = await prisma.payment.findMany({
          where: {
            moduleId: id,
            module: "COUNTER_SALES"
          }
        });
        
        const formattedInvoice = {
          ...invoice,
          payments: payments.map(p => ({
            ...p,
            billAmount: Number(p.billAmount || 0),
            collectedAmount: Number(p.collectedAmount || 0)
          }))
        };

        return res.json({
          code: 200,
          response: {
             code: 200,
             data: formattedInvoice
          }
        });
      }
      return res.status(404).json({ code: 404, msg: "Not found" });
    } catch (err) {
      logger.error("Get one sale spare invoice error:", err);
      return res.json({ code: 500, msg: "Server error" });
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
          { partyName: { name: { contains: inputValue, mode: 'insensitive' } } }
        ]
      };

      const [invoices, count] = await Promise.all([
        prisma.saleSpareInvoice.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.invoiceInclude
        }),
        prisma.saleSpareInvoice.count({ where })
      ]);

      return res.json({
        code: 200,
        response: { count, saleSpareInvoice: invoices }
      });
    } catch (err) {
      logger.error("Get sale spare invoice page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  updateStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id || !status) {
        return res.json({ code: 400, response: { code: 400, message: "Missing id or status" } });
      }

      // 1. Fetch invoice with related job order
      const invoice = await prisma.saleSpareInvoice.findUnique({
        where: { id },
        include: { jobOrder: true }
      });

      if (!invoice) {
        return res.json({ code: 404, response: { code: 404, message: "Job Invoice not found" } });
      }

      // 2. Update job order status (if linked)
      if (invoice.jobOrder && invoice.jobOrder.id) {
        await prisma.jobOrder.update({
          where: { id: invoice.jobOrder.id },
          data: { jobStatus: status },
        });
      }

      // 3. Update sale spare invoice status
      const updatedInvoice = await prisma.saleSpareInvoice.update({
        where: { id },
        data: { status },
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Job Invoice and Sale Spare Invoice status updated successfully",
          data: {
            invoice: updatedInvoice
          }
        }
      });
    } catch (err) {
      logger.error("Update sale spare invoice status error:", err);
      return res.json({ code: 500, response: { code: 500, message: "Failed to update status", data: err } });
    }
  };
}

export default new SaleSpareInvoiceController();

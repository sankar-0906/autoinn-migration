import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Sale Spare Invoice operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class SaleSpareInvoiceController {
  // Shared include object for SaleSpareInvoice
  invoiceInclude = {
    customer: {
      include: { contacts: true }
    },
    branch: true,
    saleSpareItemInvoice: {
      include: {
        partNumber: true,
        hsn: true
      }
    }
  };

  createSaleSpareInvoice = async (req, res) => {
    try {
      const {
        invoiceNumber, invoiceDate, customer, itemRate,
        discountType, discountPercent, discountRate, tcs,
        cgst, sgst, igst, totalDiscount, adjustment, totalInvoice,
        saleSpareItemInvoice
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.saleSpareInvoice.create({
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
          customer: customer ? { connect: { id: customer } } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined,
          saleSpareItemInvoice: saleSpareItemInvoice && saleSpareItemInvoice.length > 0 ? {
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

      return res.json({
        code: 200,
        response: created
      });
    } catch (err) {
      logger.error("Create sale spare invoice error:", err);
      return res.json({ code: 500, msg: "An error occured", err });
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
        return res.json({
          code: 200,
          response: invoice
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one sale spare invoice error:", err);
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
          { customer: { name: { contains: inputValue, mode: 'insensitive' } } }
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
}

export default new SaleSpareInvoiceController();

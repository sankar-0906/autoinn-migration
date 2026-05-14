import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import jobInvoiceController from "./jobInvoice.js";

/**
 * Controller for Sale Spare Invoice (Counter Sales).
 * Maintained with 100% payload parity with autoinn-be.
 */
class SaleSpareInvoiceController {
  
  // Re-use logic from jobInvoiceController for consistency
  getOne = jobInvoiceController.getOne;
  
  updateStatus = jobInvoiceController.updateStatus;

  createSaleSpareInvoice = async (req, res) => {
    // Force invoiceType to be counterSale for this endpoint
    req.body.invoiceType = "counterSale";
    return jobInvoiceController.createJobInvoice(req, res);
  };

  getPage = async (req, res) => {
    // Override filter for counter sales
    req.body.invoiceType = "counterSale";
    try {
      const { page, size, searchString } = req.body;
      const skip = (page - 1) * size;

      const where = {
        AND: [
          { invoiceType: "counterSale" },
          searchString ? {
            OR: [
              { invoiceNumber: { contains: searchString, mode: 'insensitive' } },
              { partyName: { name: { contains: searchString, mode: 'insensitive' } } }
            ]
          } : {}
        ]
      };

      const [count, invoices] = await Promise.all([
        prisma.saleSpareInvoice.count({ where }),
        prisma.saleSpareInvoice.findMany({
          where,
          skip: skip || 0,
          take: size || 10,
          orderBy: { createdAt: 'desc' },
          include: jobInvoiceController.saleSpareInclude
        })
      ]);

      const formattedInvoices = invoices.map(inv => jobInvoiceController.formatSaleSpareInvoice(inv));

      return res.status(200).json({
        code: 200,
        response: {
          code: 200,
          message: "SaleSpareInvoices fetched",
          data: {
            count,
            saleSpareInvoice: formattedInvoices
          }
        }
      });
    } catch (err) {
      logger.error("Get sale spare invoice page error:", err);
      return res.json({ code: 500, response: { code: 500, message: "an error occurred" } });
    }
  };
}

export default new SaleSpareInvoiceController();

import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

import IdGenerateController from "./idGenerate.js";

/**
 * Controller for Sale Invoice operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class SaleInvoiceController {
  // Shared include object for SaleInvoice
  invoiceInclude = {
    saleRegister: true,
    party: {
      include: { contacts: true }
    },
    branch: true
  };

  createSaleInvoice = async (req, res) => {
    try {
      const {
        date, invoiceNo, saleRegister, party, address,
        vehicleModel, chassisNumber, engineNumber, color,
        mfgMonthYear, remarks, price, gst, cess, net,
        modeType, financier, hypothecation, branch,
        batteryNumber, serviceCouponNumber, hsnCode,
        modelCode, igst, cgst, sgst
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.saleInvoice.create({
        data: {
          invoiceNo,
          date: date ? new Date(date) : new Date(),
          address,
          vehicleModel,
          chassisNumber,
          engineNumber,
          color,
          mfgMonthYear,
          remarks,
          price: parseFloat(price) || 0,
          gst: parseFloat(gst) || 0,
          igst: parseFloat(igst) || 0,
          cgst: parseFloat(cgst) || 0,
          sgst: parseFloat(sgst) || 0,
          cess: parseFloat(cess) || 0,
          net: parseFloat(net) || 0,
          modeType,
          financier,
          hypothecation,
          batteryNumber,
          serviceCouponNumber,
          hsnCode,
          modelCode,
          createdAt: new Date(),
          updatedAt: new Date(),
          saleRegister: saleRegister ? { connect: { id: saleRegister } } : undefined,
          party: party ? { connect: { id: party } } : undefined,
          branch: branch ? { connect: { id: branch } } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined
        },
        include: this.invoiceInclude
      });

      // Increment ID counter
      await IdGenerateController.incrementId("VEHICLESALEINVOICE", branch);

      return res.json({
        code: 200,
        response: created
      });
    } catch (err) {
      logger.error("Create sale invoice error:", err);
      return res.json({ code: 500, msg: "An error occured", err });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await prisma.saleInvoice.findUnique({
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
      logger.error("Get one sale invoice error:", err);
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
          { chassisNumber: { contains: inputValue, mode: 'insensitive' } },
          { party: { name: { contains: inputValue, mode: 'insensitive' } } }
        ]
      };

      const [invoices, count] = await Promise.all([
        prisma.saleInvoice.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.invoiceInclude
        }),
        prisma.saleInvoice.count({ where })
      ]);

      return res.json({
        code: 200,
        response: { count, saleInvoice: invoices }
      });
    } catch (err) {
      logger.error("Get sale invoice page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };
}

export default new SaleInvoiceController();

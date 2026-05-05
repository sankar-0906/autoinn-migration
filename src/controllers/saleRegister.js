import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Sale Register operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class SaleRegisterController {
  // Shared include object for SaleRegister
  registerInclude = {
    saleInvoice: {
      include: {
        party: {
          include: {
            CustomerPhone: true
          }
        },
        branch: true
      }
    }
  };

  formatSaleRegister = (r) => {
    if (!r) return r;
    const formatted = { ...r };
    if (formatted.saleInvoice && formatted.saleInvoice.party) {
      formatted.saleInvoice.party = {
        ...formatted.saleInvoice.party,
        contacts: formatted.saleInvoice.party.CustomerPhone
      };
    }
    return formatted;
  };

  getAllSaleRegisters = async (req, res) => {
    try {
      const { page, size, searchString, status } = req.body;
      const branchIds = req.user?.branch || [];
      const skip = (page - 1) * size;
      const inputValue = searchString || "";
      const tCased = await titleCase(inputValue);

      // Search across booking data (stored in saleData JSON) or chassis/engine
      const where = {
        OR: [
          { chassisNumber: { contains: inputValue, mode: 'insensitive' } },
          { engineNo: { contains: inputValue, mode: 'insensitive' } },
          { saleInvoice: { invoiceNo: { contains: inputValue, mode: 'insensitive' } } },
          { saleInvoice: { party: { name: { contains: inputValue, mode: 'insensitive' } } } },
          { saleInvoice: { party: { name: { contains: tCased, mode: 'insensitive' } } } }
        ]
      };

      if (status) {
        where.status = status;
      }

      const [registers, count] = await Promise.all([
        prisma.saleRegister.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.registerInclude
        }),
        prisma.saleRegister.count({ where })
      ]);

      return res.json({
        code: 200,
        msg: "Sale Registers fetched",
        data: { count, registers: registers.map(r => this.formatSaleRegister(r)) }
      });
    } catch (err) {
      logger.error("Get sale registers error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getOneSaleRegister = async (req, res) => {
    try {
      const { id } = req.params;
      const register = await prisma.saleRegister.findUnique({
        where: { id },
        include: this.registerInclude
      });

      if (register) {
        return res.json({
          code: 200,
          data: this.formatSaleRegister(register)
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one sale register error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  updateSaleRegisterStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const updated = await prisma.saleRegister.update({
        where: { id },
        data: {
          status,
          updatedAt: new Date()
        },
        include: this.registerInclude
      });

      return res.json({
        code: 200,
        message: "Status updated",
        data: this.formatSaleRegister(updated)
      });
    } catch (err) {
      logger.error("Update sale register status error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };
}

export default new SaleRegisterController();

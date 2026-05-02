import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";

/**
 * Controller for Ledger details and auditing.
 */
class LedgerDetailController {
  getPage = async (req, res) => {
    try {
      const { searchString, page, size } = req.body;
      const skip = (parseInt(page) - 1) * parseInt(size);
      const take = parseInt(size);

      const [ledgers, count] = await Promise.all([
        prisma.ledger.findMany({
          skip,
          take,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.ledger.count()
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Ledgers fetched",
          data: { count, Ledger: ledgers }
        }
      });
    } catch (err) {
      logger.error("Ledger detail getPage error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const ledger = await prisma.ledger.findUnique({
        where: { id }
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Ledger fetched",
          data: ledger
        }
      });
    } catch (err) {
      logger.error("Ledger detail getOne error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };
}

export default new LedgerDetailController();

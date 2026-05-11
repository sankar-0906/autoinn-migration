import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import { normalizeBranchIds } from "../utils/branch.util.js";

/**
 * Controller for Stock Check (Inventory audits).
 */
class StockCheckController {
  getPage = async (req, res) => {
    try {
      const { page = 1, size = 10, branch } = req.body;
      const skip = (parseInt(page) - 1) * parseInt(size);
      const take = parseInt(size);

      const branchIds = normalizeBranchIds(branch);

      const where = branchIds.length > 0 ? { branchId: { in: branchIds } } : {};

      const [stockChecks, count] = await Promise.all([
        prisma.stockCheck.findMany({
          where,
          skip,
          take,
          include: {
            partNo: true,
            branch: { select: { name: true } },
            createdBy: { select: { EmployeeProfile_User_profileToEmployeeProfile: { select: { employeeName: true } } } }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.stockCheck.count({ where })
      ]);

      return res.json({
        code: 200,
        response: { count, stockChecks }
      });
    } catch (err) {
      logger.error("Stock check getPage error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const stockCheck = await prisma.stockCheck.findUnique({
        where: { id },
        include: { partNo: true, branch: true }
      });
      return res.json({
        code: 200,
        response: stockCheck
      });
    } catch (err) {
      logger.error("Stock check getOne error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getAllByBranch = async (req, res) => {
    try {
      const { branchId } = req.body;
      const stocks = await prisma.stockCheck.findMany({
        where: { branchId },
        include: { partNo: true }
      });
      return res.json({
        code: 200,
        response: stocks
      });
    } catch (err) {
      logger.error("Stock check getAllByBranch error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };
}

export default new StockCheckController();

import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";

/**
 * Controller for Ledger operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class LedgerController {
  // Shared include/fragments
  paymentInclude = {
    branch: true,
    paidBy: true,
    collectedBy: true,
    bankAccount: true
  };

  getBankAccountLedger = async (req, res) => {
    try {
      const { id } = req.params;
      const { page = 1, size = 10, status = "all" } = req.body;
      const skip = (page - 1) * size;

      let where = { bankAccountId: id, status: "SUCCESS" };
      if (status !== "all") {
        // Legacy handled 'SUCCESS' exclusively in code
      }

      const [transactions, totalCount, bank] = await Promise.all([
        prisma.payment.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.paymentInclude
        }),
        prisma.payment.count({ where }),
        prisma.bankDetail.findUnique({ where: { id } })
      ]);

      return res.json({
        code: 200,
        message: "Bank account ledger fetched successfully",
        data: {
          transactions,
          count: totalCount,
          overallBalance: bank ? bank.accountBalance : 0
        }
      });
    } catch (err) {
      logger.error("Get bank ledger error:", err);
      return res.status(500).json({ code: 500, message: "Error fetching bank account ledger", data: err });
    }
  };

  getCashAccountLedger = async (req, res) => {
    try {
      const { id: branchId } = req.params;
      const { page = 1, size = 10, status = "all" } = req.body;
      const skip = (page - 1) * size;

      let collected = [];
      let withdrawal = [];

      if (status === "collected" || status === "all") {
        collected = await prisma.payment.findMany({
          where: { branchId, status: "SUCCESS", method: "CASH" },
          orderBy: { createdAt: 'desc' },
          include: this.paymentInclude
        });
        collected = collected.map(p => ({ ...p, transactionType: "collected" }));
      }

      if (status === "withdrawal" || status === "all") {
        withdrawal = await prisma.cashWithdrawalHistory.findMany({
          where: { branchId },
          orderBy: { createdAt: 'desc' }
        });
        withdrawal = withdrawal.map(w => ({ ...w, transactionType: "withdrawal" }));
      }

      let merged = [...collected, ...withdrawal].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );

      const totalCount = merged.length;
      const paginatedData = merged.slice(skip, skip + size);

      const branch = await prisma.branch.findUnique({ where: { id: branchId } });

      return res.json({
        code: 200,
        message: "Cash account ledger fetched successfully",
        data: {
          transactions: paginatedData,
          count: totalCount,
          overallBalance: branch ? branch.accountBalance : 0
        }
      });
    } catch (err) {
      logger.error("Get cash ledger error:", err);
      return res.status(500).json({ code: 500, message: "Error fetching cash account ledger", data: err });
    }
  };

  getCustomerLedger = async (req, res) => {
    try {
      const { id: customerId } = req.params;
      const { page = 1, size = 10, module } = req.body;
      const skip = (page - 1) * size;

      const where = { paidById: customerId };
      if (module) {
        where.module = module;
      }

      const [transactions, totalCount] = await Promise.all([
        prisma.payment.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.paymentInclude
        }),
        prisma.payment.count({ where })
      ]);

      return res.json({
        code: 200,
        message: "Customer ledger fetched successfully",
        data: {
          transactions,
          count: totalCount
        }
      });
    } catch (err) {
      logger.error("Get customer ledger error:", err);
      return res.status(500).json({ code: 500, message: "Error fetching customer ledger", data: err });
    }
  };

  getEmployeeLedger = async (req, res) => {
    try {
      const { id: employeeId } = req.params;
      const { page = 1, size = 10, module = "all" } = req.body;
      const skip = (page - 1) * size;

      let receipts = [];
      let payments = [];

      if (module === "receipt" || module === "all") {
        receipts = await prisma.payment.findMany({
          where: { collectedById: employeeId },
          orderBy: { createdAt: 'desc' },
          include: this.paymentInclude
        });
        receipts = receipts.map(r => ({ ...r, transactionType: "receipt" }));
      }

      if (module === "payment" || module === "all") {
        payments = await prisma.companyPayment.findMany({
          where: { paidById: employeeId },
          orderBy: { createdAt: 'desc' }
        });
        payments = payments.map(p => ({ ...p, transactionType: "payment" }));
      }

      let merged = [...receipts, ...payments].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );

      const totalCount = merged.length;
      const paginatedData = merged.slice(skip, skip + size);

      return res.json({
        code: 200,
        message: "Employee ledger fetched successfully",
        data: {
          transactions: paginatedData,
          count: totalCount
        }
      });
    } catch (err) {
      logger.error("Get employee ledger error:", err);
      return res.status(500).json({ code: 500, message: "Error fetching employee ledger", data: err });
    }
  };
}

export default new LedgerController();

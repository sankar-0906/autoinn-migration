import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import axios from "axios";

class PaymentController {
  constructor() {
    this.fragment = {
      bank: true,
      branch: true,
      collectedBy: true,
      paidBy: true,
      supplier: true,
      denominations: true
    };
  }

  createPaymentPending = async (data, user) => {
    try {
      let {
        module,
        branch,
        moduleId,
        eReceiptId,
        billAmount,
        collectedBy,
        supplier,
        mpr,
        paidBy,
        collectedAmount = 0,
        changeReturned = 0,
        method,
        denominations = []
      } = data;

      billAmount = parseFloat(billAmount) || 0;
      collectedAmount = parseFloat(collectedAmount) || 0;
      changeReturned = parseFloat(changeReturned) || 0;
      mpr = parseFloat(mpr) || 0;

      const paymentStatus = module === "FINANCER_DUE" ? "SUCCESS" : "PENDING";

      // Create Payment
      const payment = await prisma.payment.create({
        data: {
          module,
          moduleId,
          billAmount,
          receiptId: eReceiptId,
          collectedAmount,
          changeReturned,
          mpr,
          method,
          status: paymentStatus,
          createdAt: new Date(),
          updatedAt: new Date(),
          paidBy: paidBy ? { connect: { id: paidBy } } : undefined,
          collectedBy: collectedBy ? { connect: { id: collectedBy } } : undefined,
          supplier: supplier ? { connect: { id: supplier } } : undefined,
          branch: branch ? { connect: { id: branch } } : undefined,
          bank: (data.bank && method === "Bank Transfer") ? { connect: { id: data.bank } } : undefined,
          denominations: denominations.length ? {
            create: denominations.map((d) => ({
              denomination: parseFloat(d.denomination),
              count: parseInt(d.count),
              transactionType: d.type,
              amount: parseFloat(d.denomination) * parseInt(d.count),
              branch: branch ? { connect: { id: branch } } : undefined,
              createdAt: new Date()
            })),
          } : undefined,
        },
        include: this.fragment
      });

      // === Job Invoice: mark invoice as INVOICED on payment creation ===
      if (module === "JOB_INVOICE" && moduleId) {
        try {
          await prisma.saleSpareInvoice.update({
            where: { id: moduleId },
            data: { status: "INVOICED", updatedAt: new Date() }
          });
        } catch (invoiceErr) {
          logger.error("createPaymentPending: failed to set invoice INVOICED status:", invoiceErr);
        }
      }

      return {
        code: 200,
        message: "Payment created with PENDING status",
        data: payment,
      };
    } catch (err) {
      logger.error("Error creating payment:", err);
      throw {
        code: 500,
        message: "Error creating payment",
        data: err,
      };
    }
  };


  updatePayment = async (data, user) => {
    try {
      let {
        paymentId,
        balanceAmount,
        status,
        amount,
        paymentMethod,
        branchId,
        denominations = [],
        bank,
        dateOfPayment
      } = data;

      if (!paymentId) {
        return { code: 400, message: "Payment ID is required" };
      }

      // Fetch existing payment
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId }
      });

      if (!payment) {
        return { code: 404, message: "Payment not found" };
      }

      // Calculate collectedAmount (CREDIT sum) and changeReturned (DEBIT sum)
      let collectedAmount = parseFloat(payment.collectedAmount || 0);
      let changeReturned = 0, newlycollected = 0;

      if (Array.isArray(denominations) && denominations.length > 0) {
        denominations.forEach((d) => {
          const total = parseFloat(d.denomination) * parseInt(d.count);
          if (d.type === "CREDIT") newlycollected += total;
          else if (d.type === "DEBIT") changeReturned += total;
        });
      }

      collectedAmount += newlycollected - changeReturned;

      // For non-cash payments, use direct amount
      if (paymentMethod !== "CASH") {
        collectedAmount = amount !== undefined ? parseFloat(amount) : parseFloat(payment.collectedAmount || 0);
        changeReturned = 0;
      }

      let accountBalance = 0;
      const method = paymentMethod || payment.method;

      // Update Account Balances (Real-time)
      if (status === "SUCCESS" && payment.status !== "SUCCESS") {
        if (method === "CASH" && branchId) {
          const branch = await prisma.branch.findUnique({ where: { id: branchId } });
          const currentBalance = parseFloat(branch?.accountBalance || 0);
          accountBalance = currentBalance + collectedAmount;

          await prisma.branch.update({
            where: { id: branchId },
            data: { accountBalance }
          });
        } else if (method === "Bank Transfer" && bank) {
          const bankDetails = await prisma.bankDetails.findUnique({ where: { id: bank } });
          const currentBalance = parseFloat(bankDetails?.accountBalance || 0);
          accountBalance = currentBalance + collectedAmount;

          await prisma.bankDetails.update({
            where: { id: bank },
            data: { accountBalance }
          });
        } else if ((method === "UPI" || method === "CARD")) {
          const machines = await prisma.pinelabs.findMany();
          if (machines && machines.length > 0) {
            const machine = machines[0];
            const currentBalance = parseFloat(machine.accountBalance || 0);
            accountBalance = currentBalance + collectedAmount;

            await prisma.pinelabs.update({
              where: { id: machine.id },
              data: { accountBalance }
            });
          }
        }
      }

      // Update Payment record
      const updateData = {
        status: "SUCCESS",
        collectedAmount,
        changeReturned,
        method: method,
        accountBalance: accountBalance > 0 ? accountBalance : undefined,
        updatedAt: new Date(),
        branch: branchId ? { connect: { id: branchId } } : undefined,
      };

      if (bank) updateData.bank = { connect: { id: bank } };
      if (dateOfPayment) updateData.dateOfPayment = new Date(dateOfPayment);

      if (denominations.length > 0) {
        updateData.denominations = {
          create: denominations.map((d) => ({
            denomination: parseFloat(d.denomination),
            count: parseInt(d.count),
            transactionType: d.type,
            amount: parseFloat(d.denomination) * parseInt(d.count),
            branch: branchId ? { connect: { id: branchId } } : undefined,
            createdAt: new Date()
          })),
        };
      }

      const updatedPayment = await prisma.payment.update({
        where: { id: paymentId },
        data: updateData,
        include: this.fragment
      });

      // === Job Invoice: check total collected vs billAmount and set status ===
      if (updatedPayment.module === "JOB_INVOICE" && updatedPayment.moduleId) {
        try {
          const invoiceId = updatedPayment.moduleId;

          // Sum all SUCCESS payments for this invoice
          const allSuccessPayments = await prisma.payment.findMany({
            where: { module: "JOB_INVOICE", moduleId: invoiceId, status: "SUCCESS" }
          });
          const totalCollected = allSuccessPayments.reduce(
            (sum, p) => sum + Number(p.collectedAmount || 0), 0
          );

          const invoice = await prisma.saleSpareInvoice.findUnique({
            where: { id: invoiceId },
            select: { id: true, totalInvoice: true, jobOrderId: true }
          });

          if (invoice) {
            const invoiceBillAmount = Number(invoice.totalInvoice || 0);
            // Safety: only mark PAID if bill amount is valid and fully collected
            const isFullyPaid = invoiceBillAmount > 0 && totalCollected >= invoiceBillAmount;
            const newInvoiceStatus = isFullyPaid ? "PAID" : "INVOICED";

            logger.info(`[Payment] JOB_INVOICE ${invoiceId}: totalCollected=${totalCollected}, billAmount=${invoiceBillAmount}, isFullyPaid=${isFullyPaid}`);

            // Update invoice status
            await prisma.saleSpareInvoice.update({
              where: { id: invoiceId },
              data: { status: newInvoiceStatus, updatedAt: new Date() }
            });

            // Update jobOrder.jobStatus to match
            if (invoice.jobOrderId) {
              await prisma.jobOrder.update({
                where: { id: invoice.jobOrderId },
                data: { jobStatus: isFullyPaid ? "PAID" : "Proforma Invoice" }
              });
            }
          }
        } catch (statusErr) {
          logger.error("updatePayment: failed to update invoice/jobOrder status:", statusErr);
        }
      }

      // Update CompanyDenominationInventory
      for (const d of denominations) {
        if (d.count && parseInt(d.count) > 0) {
          const existing = await prisma.companyDenominationInventory.findFirst({
            where: { branchId: branchId, denomination: parseFloat(d.denomination) },
          });

          if (existing) {
            let newCount = existing.count;
            if (d.type === "CREDIT") newCount += parseInt(d.count);
            if (d.type === "DEBIT") newCount -= parseInt(d.count);
            if (newCount < 0) newCount = 0;

            await prisma.companyDenominationInventory.update({
              where: { id: existing.id },
              data: { count: newCount, lastUpdatedBy: { connect: { id: user } } },
            });
          } else if (d.type === "CREDIT") {
            await prisma.companyDenominationInventory.create({
              data: {
                denomination: parseFloat(d.denomination),
                count: parseInt(d.count),
                branch: { connect: { id: branchId } },
                lastUpdatedBy: { connect: { id: user } },
                createdAt: new Date()
              },
            });
          }
        }
      }

      return {
        code: 200,
        message: "Payment updated successfully",
        data: updatedPayment,
      };
    } catch (err) {
      logger.error("Error updating payment:", err);
      throw {
        code: 500,
        message: "Error updating payment",
        data: err,
      };
    }
  };

  initiateCardPayment = async (data) => {
    try {
      const { paymentId, amount, branchId, userId, paymentMode, billAmount, mode } = data;

      const allConfigs = await prisma.pinelabs.findMany();

      const config = allConfigs.find(c => c.userIds && c.userIds.includes(userId));

      if (!config) {
        throw {
          code: 403,
          message: "No Pine Labs configuration found for this user"
        };
      }
      
      const payment = await prisma.payment.update({
        where: { id: paymentId },
        data: { method: mode, status: "PENDING", billAmount: parseFloat(billAmount) },
        include: this.fragment
      });

      let mpr = parseFloat(config.MBR || 0);
      let original = amount / 100;
      let newamount = mode === "UPI" ? original : original + (original * (mpr / 100));
      let final = newamount * 100;

      const pineLabsPayload = {
        TransactionNumber: paymentId.toString(),
        SequenceNumber: 1,
        AllowedPaymentMode: paymentMode,
        ClientID: config.clientId,
        Amount: Math.round(final).toString(),
        UserID: config.machineId,
        MerchantID: config.merchantId,
        StoreID: config.storeId,
        SecurityToken: config.securityToken,
        AutoCancelDurationInMinutes: 1
      };

      const pineResponse = await axios.post(
        "https://www.plutuscloudserviceuat.in:8201/API/CloudBasedIntegration/V1/UploadBilledTransaction",
        pineLabsPayload,
        { headers: { "Content-Type": "application/json" } }
      );

      const pinelabsTransaction = await prisma.pinelabsTransaction.create({
        data: {
          plutusTransactionId: pineResponse.data.PlutusTransactionReferenceID?.toString() || null,
          orderId: paymentId,
          status: pineResponse.data.Status || "INITIATED",
          responsePayload: JSON.stringify(pineResponse.data),
          payment: { connect: { id: paymentId } },
          createdAt: new Date()
        }
      });

      return {
        message: "Card payment initiated",
        payment,
        pinelabsTransaction,
        plutusTransactionReferenceId: pineResponse.data.TransactionID
      };
    } catch (err) {
      logger.error("Failed to initiate card payment:", err);
      throw { message: "Failed to initiate card payment", error: err };
    }
  };

  getCardStatus = async (plutusTransactionId, userId) => {
    try {
      if (!plutusTransactionId) {
        throw { code: 400, message: "Transaction ID required" };
      }

      const allConfigs = await prisma.pinelabs.findMany();

      const config = allConfigs.find(c => c.userIds && c.userIds.includes(userId));

      if (!config) {
        throw {
          code: 403,
          message: "No Pine Labs configuration found for this user"
        };
      }

      const pineLabsPayload = {
        ClientID: config.clientId,
        MerchantID: config.merchantId,
        StoreID: config.storeId,
        SecurityToken: config.securityToken,
        PlutusTransactionReferenceID: plutusTransactionId
      };

      const pineResponse = await axios.post(
        "https://www.plutuscloudserviceuat.in:8201/API/CloudBasedIntegration/V1/GetCloudBasedTxnStatus",
        pineLabsPayload,
        { headers: { "Content-Type": "application/json" } }
      );

      let updatedStatus = "INITIATED";
      if (pineResponse.data.TransactionData) {
        const transaction = await prisma.pinelabsTransaction.findFirst({
          where: { plutusTransactionId: plutusTransactionId.toString() },
        });

        if (transaction) {
          const result = await prisma.pinelabsTransaction.update({
            where: { id: transaction.id },
            data: { status: "SUCCESS", updatedAt: new Date() },
          });
          updatedStatus = result.status;
        }
      }

      return {
        code: 200,
        message: "Transaction status fetched",
        response: {
          plutusTransactionId: plutusTransactionId,
          status: updatedStatus,
        },
      };
    } catch (err) {
      logger.error("Error fetching card status:", err);
      throw { code: 500, message: "Error fetching card status", error: err };
    }
  };
}

export default new PaymentController();

import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";


class IdGenerateController {
  constructor() {}

  employeeIdGenerate = async (data, user) => {
    try {
      const { branch = null } = data;
      // Note: subModule check should be case-sensitive depending on how they were seeded
      let idCreation = await prisma.idCreation.findFirst({
        where: { subModule: "EMPLOYEE", branch: branch ? { id: branch } : undefined },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule: "EMPLOYEE" },
          orderBy: { createdAt: "desc" },
        });
      }

      if (!idCreation) {
        const count = await prisma.user.count();
        if (count === 0) {
          const nextCount = (1).toLocaleString("en-US", {
            minimumIntegerDigits: 3,
            useGrouping: false,
          });
          return { code: 200, message: "UserId Generated", data: "EMPNY" + nextCount };
        } else {
          const lastUser = await prisma.user.findFirst({
            where: { phone2: { startsWith: "EMPNY" } }, // Legacy used employeeId but phone2 is @unique in new schema for some reason
            orderBy: { createdAt: "desc" },
          });
          // In new schema EmployeeProfile has employeeId
          const lastProfile = await prisma.employeeProfile.findFirst({
            where: { employeeId: { startsWith: "EMPNY" } },
            orderBy: { createdAt: "desc" }
          });

          let id = 1;
          if (lastProfile && lastProfile.employeeId) {
            id = parseInt(lastProfile.employeeId.slice(5)) + 1;
          }
          const nextCount = id.toLocaleString("en-US", {
            minimumIntegerDigits: 3,
            useGrouping: false,
          });
          return { code: 200, message: "UserId Generated", data: "EMPNY" + nextCount };
        }
      } else {
        return { code: 200, message: "UserId Generated", data: idCreation.text + idCreation.count };
      }
    } catch (err) {
      logger.error("CONTROLLER.IdGenerate.employeeId", err);
      throw { code: 500, message: "error generating employee Id", data: err };
    }
  };

  customerIdGenerate = async (data, user) => {
    try {
      const { branch = null } = data;
      let idCreation = await prisma.idCreation.findFirst({
        where: { subModule: "CUSTOMER", branch: branch ? { id: branch } : undefined },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule: "CUSTOMER" },
          orderBy: { createdAt: "desc" },
        });
      }

      if (!idCreation) {
        const lastCustomer = await prisma.customer.findFirst({
          where: { customerId: { startsWith: "CUSNY" } },
          orderBy: { createdAt: "desc" },
        });
        let id = 1;
        if (lastCustomer && lastCustomer.customerId) {
          id = parseInt(lastCustomer.customerId.slice(5)) + 1;
        }
        const nextCount = id.toLocaleString("en-US", {
          minimumIntegerDigits: 3,
          useGrouping: false,
        });
        return { code: 200, message: "CustomerId Generated", data: "CUSNY" + nextCount };
      } else {
        return { code: 200, message: "CustomerId Generated", data: idCreation.text + idCreation.count };
      }
    } catch (err) {
      logger.error("CONTROLLER.IdGenerate.customerId", err);
      throw { code: 500, message: "error generating customer Id", data: err };
    }
  };

  quotationIdGenerate = async (branches, data) => {
    try {
      const { branch = null } = data;
      let idCreation = await prisma.idCreation.findFirst({
        where: { 
          subModule: "QUOTATIONS", 
          branch: branch ? { id: branch } : (branches ? { id: { in: branches } } : undefined)
        },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule: "QUOTATIONS" },
          orderBy: { createdAt: "desc" },
        });
      }

      let QuotationId;
      if (!idCreation) {
        const lastQuotation = await prisma.quotation.findFirst({
          where: { quotationId: { startsWith: "QUONY" } },
          orderBy: { createdAt: "desc" },
        });
        let id = 1;
        if (lastQuotation && lastQuotation.quotationId) {
          id = parseInt(lastQuotation.quotationId.slice(5)) + 1;
        }
        const nextCount = id.toLocaleString("en-US", {
          minimumIntegerDigits: 3,
          useGrouping: false,
        });
        QuotationId = "QUONY" + nextCount;
      } else {
        QuotationId = idCreation.text + idCreation.count;
      }
      
      const customerIdRes = await this.customerIdGenerate({ branch: "" });
      return {
        code: 200,
        message: "QuotationId Generated",
        data: { QuotationId, customerId: customerIdRes.data },
      };
    } catch (err) {
      logger.error("CONTROLLER.IdGenerate.quotationId", err);
      throw { code: 500, message: "error generating quotation Id", data: err };
    }
  };

  bookingIdGenerate = async (data, user) => {
    try {
      const { branch = null } = data;
      let idCreation = await prisma.idCreation.findFirst({
        where: { subModule: "BOOKINGREGISTER", branch: branch ? { id: branch } : undefined },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule: "BOOKINGREGISTER" },
          orderBy: { createdAt: "desc" },
        });
      }

      if (!idCreation) {
        const lastBooking = await prisma.booking.findFirst({
          where: { bookingId: { startsWith: "BOKNY" } },
          orderBy: { createdAt: "desc" },
        });
        let id = 1;
        if (lastBooking && lastBooking.bookingId) {
          id = parseInt(lastBooking.bookingId.slice(5)) + 1;
        }
        const nextCount = id.toLocaleString("en-US", {
          minimumIntegerDigits: 3,
          useGrouping: false,
        });
        return { code: 200, message: "BookingId Generated", data: "BOKNY" + nextCount };
      } else {
        const BookingId = idCreation.text + idCreation.count;
        // Increment counter
        const nextVal = parseInt(idCreation.count) + 1;
        const nextCount = nextVal.toLocaleString("en-US", {
          minimumIntegerDigits: idCreation.count.length,
          useGrouping: false,
        });
        await prisma.idCreation.update({
          where: { id: idCreation.id },
          data: { count: nextCount.toString() }
        });
        return { code: 200, message: "BookingId Generated", data: BookingId };
      }
    } catch (err) {
      logger.error("CONTROLLER.IdGenerate.bookingId", err);
      throw { code: 500, message: "error generating booking Id", data: err };
    }
  };

  activity = async (data) => {
    const timestamp = Date.now().toString();
    return { code: 200, message: "Activity ID generated", data: "ACT" + timestamp };
  };

  saleChallanIdGenerate = async (data) => {
    try {
      const last = await prisma.saleChallan.findFirst({
        where: { fileNo: { startsWith: "SCHNY" } },
        orderBy: { createdAt: "desc" }
      });
      let id = 1;
      if (last && last.fileNo) id = parseInt(last.fileNo.slice(5)) + 1;
      const count = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
      return { code: 200, message: "SaleChallanId Generated", data: "SCHNY" + count };
    } catch (err) {
      throw { code: 500, message: "error generating saleChallan Id", data: err };
    }
  };

  saleInvoiceIdGenerate = async (data) => {
    try {
      const last = await prisma.saleInvoice.findFirst({
        where: { invoiceNo: { startsWith: "SINNY" } },
        orderBy: { createdAt: "desc" }
      });
      let id = 1;
      if (last && last.invoiceNo) id = parseInt(last.invoiceNo.slice(5)) + 1;
      const count = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
      return { code: 200, message: "SaleInvoiceId Generated", data: "SINNY" + count };
    } catch (err) {
      throw { code: 500, message: "error generating saleInvoice Id", data: err };
    }
  };

  jobOrderIdGenerate = async (branches, data) => {
    try {
      const last = await prisma.jobOrder.findFirst({
        where: { jobCardId: { startsWith: "JOBNY" } },
        orderBy: { createdAt: "desc" }
      });
      let id = 1;
      if (last && last.jobCardId) id = parseInt(last.jobCardId.slice(5)) + 1;
      const count = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
      return { code: 200, message: "JobOrderId Generated", data: "JOBNY" + count };
    } catch (err) {
      throw { code: 500, message: "error generating jobOrder Id", data: err };
    }
  };

  estimateIdGenerate = async (branches, data) => {
    try {
      const last = await prisma.estimate.findFirst({
        where: { estimateId: { startsWith: "ESTNY" } },
        orderBy: { createdAt: "desc" }
      });
      let id = 1;
      if (last && last.estimateId) id = parseInt(last.estimateId.slice(5)) + 1;
      const count = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
      return { code: 200, message: "EstimateId Generated", data: "ESTNY" + count };
    } catch (err) {
      throw { code: 500, message: "error generating estimate Id", data: err };
    }
  };
}

export default new IdGenerateController();

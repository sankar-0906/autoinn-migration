import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";


class IdGenerateController {
  constructor() {}

  incrementId = async (subModule, branchIdInput) => {
    try {
      const branchId = (branchIdInput && typeof branchIdInput === "object") ? branchIdInput.id : branchIdInput;
      let idCreation = await prisma.idCreation.findFirst({
        where: { subModule, branch: branchId || null },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule },
          orderBy: { createdAt: "desc" },
        });
      }

      if (idCreation) {
        const nextVal = parseInt(idCreation.count || "0") + 1;
        const nextCount = nextVal.toLocaleString("en-US", {
          minimumIntegerDigits: idCreation.count?.length || 3,
          useGrouping: false,
        });
        await prisma.idCreation.update({
          where: { id: idCreation.id },
          data: { count: nextCount.toString(), updatedAt: new Date() }
        });
        return true;
      }
      return false;
    } catch (err) {
      logger.error(`Error incrementing ID for ${subModule}:`, err);
      return false;
    }
  };

  employeeIdGenerate = async (data, user) => {
    try {
      const { branch = null } = data;
      let idCreation = await prisma.idCreation.findFirst({
        where: { subModule: "EMPLOYEE", branch: branch || undefined },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule: "EMPLOYEE" },
          orderBy: { createdAt: "desc" },
        });
      }

      if (!idCreation) {
        const lastProfile = await prisma.employeeProfile.findFirst({
          where: { employeeId: { startsWith: "EMPNY" } },
          orderBy: { createdAt: "desc" }
        });
        let id = 1;
        if (lastProfile && lastProfile.employeeId) {
          id = parseInt(lastProfile.employeeId.slice(5)) + 1;
        }
        const nextCount = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
        return { code: 200, message: "UserId Generated", data: "EMPNY" + nextCount };
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
        where: { subModule: "CUSTOMER", branch: branch || undefined },
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
        const nextCount = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
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
          branch: branch || undefined
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
        const nextCount = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
        QuotationId = "QUONY" + nextCount;
      } else {
        QuotationId = idCreation.text + idCreation.count;
      }
      
      const customerIdRes = await this.customerIdGenerate({ branch: branch });
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
        where: { subModule: "BOOKINGREGISTER", branch: branch || undefined },
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
        const nextCount = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
        return { code: 200, message: "BookingId Generated", data: "BOKNY" + nextCount };
      } else {
        const BookingId = idCreation.text + idCreation.count;
        // Booking is one of the few that increments DURING generation in legacy
        await this.incrementId("BOOKINGREGISTER", branch);
        return { code: 200, message: "BookingId Generated", data: BookingId };
      }
    } catch (err) {
      logger.error("CONTROLLER.IdGenerate.bookingId", err);
      throw { code: 500, message: "error generating booking Id", data: err };
    }
  };

  activity = async (data) => {
    try {
      const { branch = null } = data;
      let idCreation = await prisma.idCreation.findFirst({
        where: { subModule: "ACTIVITY", branch: branch || undefined },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule: "ACTIVITY" },
          orderBy: { createdAt: "desc" },
        });
      }

      if (idCreation) {
        const activityId = idCreation.text + idCreation.count;
        await this.incrementId("ACTIVITY", branch);
        return { code: 200, message: "Activity ID generated", data: activityId };
      } else {
        const timestamp = Date.now().toString();
        return { code: 200, message: "Activity ID generated", data: "ACT" + timestamp };
      }
    } catch (err) {
      const timestamp = Date.now().toString();
      return { code: 200, message: "Activity ID generated", data: "ACT" + timestamp };
    }
  };

  saleChallanIdGenerate = async (data) => {
    try {
      const { branch = null } = data;
      let idCreation = await prisma.idCreation.findFirst({
        where: { subModule: "SALECHALLAN", branch: branch || undefined },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule: "SALECHALLAN" },
          orderBy: { createdAt: "desc" },
        });
      }

      if (idCreation) {
        return { code: 200, message: "SaleChallanId Generated", data: idCreation.text + idCreation.count };
      } else {
        const last = await prisma.saleRegister.findFirst({
          where: { fileNo: { startsWith: "SCHNY" } },
          orderBy: { createdAt: "desc" }
        });
        let id = 1;
        if (last && last.fileNo) id = parseInt(last.fileNo.slice(5)) + 1;
        const count = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
        return { code: 200, message: "SaleChallanId Generated", data: "SCHNY" + count };
      }
    } catch (err) {
      throw { code: 500, message: "error generating saleChallan Id", data: err };
    }
  };

  saleInvoiceIdGenerate = async (data) => {
    try {
      const { branch = null } = data;
      let idCreation = await prisma.idCreation.findFirst({
        where: { subModule: "VEHICLESALEINVOICE", branch: branch || undefined },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule: "VEHICLESALEINVOICE" },
          orderBy: { createdAt: "desc" },
        });
      }

      if (idCreation) {
        return { code: 200, message: "SaleInvoiceId Generated", data: idCreation.text + idCreation.count };
      } else {
        const last = await prisma.saleInvoice.findFirst({
          where: { invoiceNo: { startsWith: "SINNY" } },
          orderBy: { createdAt: "desc" }
        });
        let id = 1;
        if (last && last.invoiceNo) id = parseInt(last.invoiceNo.slice(5)) + 1;
        const count = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
        return { code: 200, message: "SaleInvoiceId Generated", data: "SINNY" + count };
      }
    } catch (err) {
      throw { code: 500, message: "error generating saleInvoice Id", data: err };
    }
  };

  jobOrderIdGenerate = async (branches, data) => {
    try {
      const { branch = null } = data;
      let idCreation = await prisma.idCreation.findFirst({
        where: { 
          subModule: "JOBORDER", 
          branch: branch || undefined
        },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule: "JOBORDER" },
          orderBy: { createdAt: "desc" },
        });
      }

      if (idCreation) {
        return { code: 200, message: "JobOrderId Generated", data: idCreation.text + idCreation.count };
      } else {
        const last = await prisma.jobOrder.findFirst({
          where: { jobCardId: { startsWith: "JOBNY" } },
          orderBy: { createdAt: "desc" }
        });
        let id = 1;
        if (last && last.jobCardId) id = parseInt(last.jobCardId.slice(5)) + 1;
        const count = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
        return { code: 200, message: "JobOrderId Generated", data: "JOBNY" + count };
      }
    } catch (err) {
      throw { code: 500, message: "error generating jobOrder Id", data: err };
    }
  };

  estimateIdGenerate = async (branches, data) => {
    try {
      const { branch = null } = data;
      let idCreation = await prisma.idCreation.findFirst({
        where: { 
          subModule: "ESTIMATE", 
          branch: branch || undefined
        },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule: "ESTIMATE" },
          orderBy: { createdAt: "desc" },
        });
      }

      if (idCreation) {
        return { code: 200, message: "EstimateId Generated", data: idCreation.text + idCreation.count };
      } else {
        const last = await prisma.estimate.findFirst({
          where: { estimateNo: { startsWith: "ESTNY" } },
          orderBy: { createdAt: "desc" }
        });
        let id = 1;
        if (last && last.estimateNo) id = parseInt(last.estimateNo.slice(5)) + 1;
        const count = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
        return { code: 200, message: "EstimateId Generated", data: "ESTNY" + count };
      }
    } catch (err) {
      throw { code: 500, message: "error generating estimate Id", data: err };
    }
  };

  purchaseChallanIdGenerate = async (data) => {
    try {
      const { branch = null } = data;
      let idCreation = await prisma.idCreation.findFirst({
        where: { subModule: "VPC", branch: branch || undefined },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule: "VPC" },
          orderBy: { createdAt: "desc" },
        });
      }

      if (idCreation) {
        return { code: 200, message: "PurchaseChallanId Generated", data: idCreation.text + idCreation.count };
      } else {
        const last = await prisma.vehiclePurchaseChallan.findFirst({
          where: { challanNo: { startsWith: "VPCNY" } },
          orderBy: { createdAt: "desc" }
        });
        let id = 1;
        if (last && last.challanNo) id = parseInt(last.challanNo.slice(5)) + 1;
        const count = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
        return { code: 200, message: "PurchaseChallanId Generated", data: "VPCNY" + count };
      }
    } catch (err) {
      throw { code: 500, message: "error generating purchaseChallan Id", data: err };
    }
  };

  purchaseInvoiceIdGenerate = async (data) => {
    try {
      const { branch = null } = data;
      let idCreation = await prisma.idCreation.findFirst({
        where: { subModule: "VPI", branch: branch || undefined },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule: "VPI" },
          orderBy: { createdAt: "desc" },
        });
      }

      if (idCreation) {
        return { code: 200, message: "PurchaseInvoiceId Generated", data: idCreation.text + idCreation.count };
      } else {
        const last = await prisma.vehiclePurchaseInvoice.findFirst({
          where: { invoiceNo: { startsWith: "VPINY" } },
          orderBy: { createdAt: "desc" }
        });
        let id = 1;
        if (last && last.invoiceNo) id = parseInt(last.invoiceNo.slice(5)) + 1;
        const count = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
        return { code: 200, message: "PurchaseInvoiceId Generated", data: "VPINY" + count };
      }
    } catch (err) {
      throw { code: 500, message: "error generating purchaseInvoice Id", data: err };
    }
  };

  saleSpareInvoiceIdGenerate = async (data) => {
    try {
      const { branch = null } = data;
      let idCreation = await prisma.idCreation.findFirst({
        where: { subModule: "CUSTOMERSALESSPARE", branch: branch || undefined },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule: "CUSTOMERSALESSPARE" },
          orderBy: { createdAt: "desc" },
        });
      }

      if (idCreation) {
        return { code: 200, message: "SaleSparesId Generated", data: idCreation.text + idCreation.count };
      } else {
        const last = await prisma.saleSpareInvoice.findFirst({
          where: { invoiceNumber: { startsWith: "SSPNY" } },
          orderBy: { createdAt: "desc" }
        });
        let id = 1;
        if (last && last.invoiceNumber) id = parseInt(last.invoiceNumber.slice(5)) + 1;
        const count = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
        return { code: 200, message: "SaleSparesId Generated", data: "SSPNY" + count };
      }
    } catch (err) {
      throw { code: 500, message: "error generating saleSpares Id", data: err };
    }
  };

  jobInvoiceIdGenerate = async (data) => {
    try {
      const { branch = null } = data;
      let idCreation = await prisma.idCreation.findFirst({
        where: { subModule: "JOBINVOICE", branch: branch || undefined },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule: "JOBINVOICE" },
          orderBy: { createdAt: "desc" },
        });
      }

      if (idCreation) {
        return { code: 200, message: "JobInvoiceId Generated", data: idCreation.text + idCreation.count };
      } else {
        const last = await prisma.jobInvoice.findFirst({
          where: { invoiceNumber: { startsWith: "JINNY" } },
          orderBy: { createdAt: "desc" }
        });
        let id = 1;
        if (last && last.invoiceNumber) id = parseInt(last.invoiceNumber.slice(5)) + 1;
        const count = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
        return { code: 200, message: "JobInvoiceId Generated", data: "JINNY" + count };
      }
    } catch (err) {
      throw { code: 500, message: "error generating jobInvoice Id", data: err };
    }
  };

  enquiryIdGenerate = async (data) => {
    try {
      const { branch = null } = data;
      let idCreation = await prisma.idCreation.findFirst({
        where: { subModule: "ENQUIRY", branch: branch || undefined },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule: "ENQUIRY" },
          orderBy: { createdAt: "desc" },
        });
      }

      if (idCreation) {
        return { code: 200, message: "EnquiryId Generated", data: idCreation.text + idCreation.count };
      } else {
        const last = await prisma.customer.findFirst({
          where: { customerId: { startsWith: "ENQNY" } },
          orderBy: { createdAt: "desc" }
        });
        let id = 1;
        if (last && last.customerId) id = parseInt(last.customerId.slice(5)) + 1;
        const count = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
        return { code: 200, message: "EnquiryId Generated", data: "ENQNY" + count };
      }
    } catch (err) {
      throw { code: 500, message: "error generating enquiry Id", data: err };
    }
  };

  purchaseSpareInvoiceIdGenerate = async (data) => {
    try {
      const { branch = null } = data;
      let idCreation = await prisma.idCreation.findFirst({
        where: { subModule: "PSI", branch: branch || undefined },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule: "PSI" },
          orderBy: { createdAt: "desc" },
        });
      }

      if (idCreation) {
        return { code: 200, message: "PurchaseSpareInvoiceId Generated", data: idCreation.text + idCreation.count };
      } else {
        const last = await prisma.purchaseSpareInvoice.findFirst({
          where: { psiNo: { startsWith: "SPINY" } },
          orderBy: { createdAt: "desc" }
        });
        let id = 1;
        if (last && last.psiNo) id = parseInt(last.psiNo.slice(5)) + 1;
        const count = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
        return { code: 200, message: "PurchaseSpareInvoiceId Generated", data: "SPINY" + count };
      }
    } catch (err) {
      throw { code: 500, message: "error generating purchaseSpareInvoice Id", data: err };
    }
  };

  promotionsIdGenerate = async (data) => {
    try {
      const { branch = null } = data;
      let idCreation = await prisma.idCreation.findFirst({
        where: { subModule: "PROMOTIONALTASKS", branch: branch || undefined },
        orderBy: { createdAt: "desc" },
      });

      if (!idCreation) {
        idCreation = await prisma.idCreation.findFirst({
          where: { subModule: "PROMOTIONALTASKS" },
          orderBy: { createdAt: "desc" },
        });
      }

      if (idCreation) {
        return { code: 200, message: "Promotion Task Id Generated", data: idCreation.text + idCreation.count };
      } else {
        const last = await prisma.task.findFirst({
          where: { taskId: { startsWith: "PTKNY" } },
          orderBy: { createdAt: "desc" }
        });
        let id = 1;
        if (last && last.taskId) id = parseInt(last.taskId.slice(5)) + 1;
        const count = id.toLocaleString("en-US", { minimumIntegerDigits: 3, useGrouping: false });
        return { code: 200, message: "Promotion Task Id Generated", data: "PTKNY" + count };
      }
    } catch (err) {
      throw { code: 500, message: "error generating promotions Id", data: err };
    }
  };
}

export default new IdGenerateController();

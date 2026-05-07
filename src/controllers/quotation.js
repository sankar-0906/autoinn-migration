import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

import IdGenerateController from "./idGenerate.js";

/**
 * Controller for Quotation operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class QuotationController {
  // Shared include object for Quotation
  quotationInclude = {
    branch: {
      include: {
        company: true,
        contacts: true,
        bankDetails: true,
        address: {
          include: { district: true, state: true, country: true }
        }
      }
    },
    customer: {
      include: {
        CustomerPhone: true,
        address: {
          include: { district: true, state: true, country: true }
        }
      }
    },
    QuotationVehicle: {
      include: {
        vehicleDetail: {
          include: {
            manufacturer: true,
            images: true,
            prices: true
          }
        },
        InsuranceType: true,
        OptionalType: true,
        color: true,
        price: true,
        financer: true
      }
    },
    executive: {
      include: {
        EmployeeProfile_User_profileToEmployeeProfile: {
          include: {
            department: true,
            branch: true
          }
        }
      }
    },
    assignedBranch: true,
    assignedExecutive: {
      include: {
        EmployeeProfile_User_profileToEmployeeProfile: {
          include: { department: true }
        }
      }
    },
    SmsHistory: true
  };

  formatQuotation = (q) => {
    if (!q) return q;
    const formatted = { ...q };
    
    // Map QuotationVehicle to vehicle
    if (q.QuotationVehicle) {
      formatted.vehicle = q.QuotationVehicle.map(qv => ({
        ...qv,
        vehicleDetail: qv.vehicleDetail ? {
          ...qv.vehicleDetail,
          manufacturer: qv.vehicleDetail.manufacturer,
          image: qv.vehicleDetail.images,
          price: qv.vehicleDetail.prices
        } : null,
        insuranceType: qv.InsuranceType,
        optionalType: qv.OptionalType
      }));
    } else {
      formatted.vehicle = [];
    }

    // Map CustomerPhone to contacts
    if (q.customer) {
      formatted.customer = {
        ...q.customer,
        contacts: q.customer.CustomerPhone
      };
    }

    // Map EmployeeProfile relation to profile
    if (q.executive) {
      formatted.executive = {
        ...q.executive,
        profile: q.executive.EmployeeProfile_User_profileToEmployeeProfile
      };
    }

    if (q.assignedExecutive) {
      formatted.assignedExecutive = {
        ...q.assignedExecutive,
        profile: q.assignedExecutive.EmployeeProfile_User_profileToEmployeeProfile
      };
    }

    // Map SmsHistory to sms
    formatted.sms = q.SmsHistory;

    return formatted;
  };

  createQuotation = async (req, res) => {
    try {
      console.log("\n=================== INCOMING QUOTATION PAYLOAD ===================");
      console.log(JSON.stringify(req.body, null, 2));
      console.log("==================================================================\n");
      logger.info("Incoming Quotation Payload:", JSON.stringify(req.body));

      const data = req.body;
      const user = req.user?.id || req.headers["user-id"];
      
      const payload = data.finalData ? (typeof data.finalData === 'string' ? JSON.parse(data.finalData) : data.finalData) : data;

      const {
        quotationId, quotationPhone, customerName, gender, locality,
        expectedDateOfPurchase, vehicle, customer, branch, executive,
        leadSource, enquiryType, testDriveTaken, remarks, scheduleDate, scheduleTime
      } = payload;

      const created = await prisma.quotation.create({
        data: {
          quotationId,
          quotationPhone,
          customerName,
          gender,
          locality,
          expectedDateOfPurchase: expectedDateOfPurchase ? new Date(expectedDateOfPurchase) : undefined,
          leadSource,
          enquiryType,
          testDriveTaken,
          remarks,
          scheduleDate,
          scheduleTime,
          createdAt: new Date(),
          updatedAt: new Date(),
          branch: branch ? { connect: { id: branch } } : undefined,
          customer: customer ? { connect: { id: customer } } : undefined,
          executive: executive ? { connect: { id: executive } } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined,
          QuotationVehicle: vehicle ? {
            create: Array.isArray(vehicle) ? vehicle.map(v => ({
              vehicleDetail: { connect: { id: v.vehicleDetail } },
              color: v.color ? { connect: { id: v.color } } : undefined,
              price: v.price ? { connect: { id: v.price } } : undefined,
              financer: v.financer ? { connect: { id: v.financer } } : undefined,
              financerTenure: v.financerTenure,
              downPayment: v.downPayment ? parseFloat(v.downPayment) : 0,
              createdAt: new Date(),
              updatedAt: new Date()
            })) : {
              vehicleDetail: { connect: { id: vehicle.vehicleDetail } },
              color: vehicle.color ? { connect: { id: vehicle.color } } : undefined,
              price: vehicle.price ? { connect: { id: vehicle.price } } : undefined,
              financer: vehicle.financer ? { connect: { id: vehicle.financer } } : undefined,
              financerTenure: vehicle.financerTenure,
              downPayment: vehicle.downPayment ? parseFloat(vehicle.downPayment) : 0,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          } : undefined
        },
        include: this.quotationInclude
      });

      // Increment ID counter
      await IdGenerateController.incrementId("QUOTATIONS", branch);

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Quotation created",
          data: this.formatQuotation(created)
        }
      });
    } catch (err) {
      logger.error("Create quotation error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const quotation = await prisma.quotation.findUnique({
        where: { id },
        include: this.quotationInclude
      });

      if (quotation) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "Quotation fetched",
            data: this.formatQuotation(quotation)
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one quotation error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString, status, filter, branch } = req.body;
      const userBranchIds = req.user?.branch || [];
      const branchIds = branch || userBranchIds; // Use frontend branches if provided, else user branches
      const skip = (page - 1) * size;
      const inputValue = searchString || "";

      const where = {
        branchId: { in: Array.isArray(branchIds) ? branchIds : [branchIds] },
      };

      if (inputValue) {
        where.OR = [
          { quotationId: { contains: inputValue, mode: 'insensitive' } },
          { customerName: { contains: inputValue, mode: 'insensitive' } },
          { quotationPhone: { contains: inputValue, mode: 'insensitive' } }
        ];
      }

      // Tab filtering
      if (status && status !== "ALL") {
        where.quotationStatus = status;
      }

      // Advanced filters
      if (filter) {
        if (filter.status && filter.status !== "ALL") {
          where.quotationStatus = filter.status;
        }
        if (filter.fromDate && filter.toDate) {
          where.createdAt = {
            gte: new Date(filter.fromDate),
            lte: new Date(filter.toDate)
          };
        }
      }

      const [quotations, count] = await Promise.all([
        prisma.quotation.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.quotationInclude
        }),
        prisma.quotation.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "quotations fetched",
          data: { count, Quotation: quotations.map(q => this.formatQuotation(q)) }
        }
      });
    } catch (err) {
      logger.error("Get quotation page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  getCusQuotation = async (req, res) => {
    try {
      const { id } = req.params;
      const quotations = await prisma.quotation.findMany({
        where: { customerId: id },
        include: this.quotationInclude
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "vehicle fetched",
          data: quotations.map(q => this.formatQuotation(q))
        }
      });
    } catch (err) {
      logger.error("Get cus quotation error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
    }
  };

  assignExecutive = async (req, res) => {
    try {
      const { branch, executive, quotationId } = req.body;
      
      const updated = await prisma.quotation.update({
        where: { id: quotationId },
        data: {
          assignedBranch: { connect: { id: branch.id } },
          assignedExecutive: { connect: { id: executive.id } }
        },
        include: this.quotationInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Assigned executive updated",
          data: this.formatQuotation(updated)
        }
      });
    } catch (err) {
      logger.error("Assign executive error:", err);
      return res.json({ code: 500, message: "An Error Occured" });
    }
  };
}

export default new QuotationController();

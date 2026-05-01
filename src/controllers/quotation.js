import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

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
        contacts: true,
        address: {
          include: { district: true, state: true, country: true }
        }
      }
    },
    vehicle: {
      include: {
        vehicleDetail: {
          include: {
            manufacturer: true,
            image: true,
            price: true
          }
        },
        insuranceType: true,
        optionalType: true,
        color: true,
        price: true,
        financer: true
      }
    },
    executive: {
      include: {
        profile: {
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
        profile: {
          include: { department: true }
        }
      }
    },
    sms: true
  };

  createQuotation = async (req, res) => {
    try {
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
          vehicle: vehicle ? {
            create: {
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

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Quotation created",
          data: created
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
            data: quotation
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
      const { page, size, searchString } = req.body;
      const branchIds = req.user?.branch || [];
      const skip = (page - 1) * size;
      const inputValue = searchString || "";

      const where = {
        branchId: { in: Array.isArray(branchIds) ? branchIds : [branchIds] },
        OR: [
          { quotationId: { contains: inputValue, mode: 'insensitive' } },
          { customerName: { contains: inputValue, mode: 'insensitive' } },
          { quotationPhone: { contains: inputValue, mode: 'insensitive' } }
        ]
      };

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
          data: { count, quotation: quotations }
        }
      });
    } catch (err) {
      logger.error("Get quotation page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
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
          data: updated
        }
      });
    } catch (err) {
      logger.error("Assign executive error:", err);
      return res.json({ code: 500, message: "An Error Occured" });
    }
  };
}

export default new QuotationController();

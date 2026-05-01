import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Job Order operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class JobOrderController {
  // Shared include object to mirror the legacy fragment
  jobOrderInclude = {
    customer: {
      include: {
        contacts: true,
        address: { include: { district: true, state: true, country: true } }
      }
    },
    vehicle: {
      include: {
        vehicle: true,
        color: true
      }
    },
    branch: {
      include: {
        company: true,
        address: { include: { district: true, state: true } },
        contacts: true
      }
    },
    mechanic: {
      include: {
        profile: { include: { department: true } }
      }
    },
    complaint: {
      include: {
        createdBy: true
      }
    }
  };

  createJobOrder = async (req, res) => {
    try {
      const {
        jobNo, customerPhone, customerId, vehicleId, branchId,
        serviceType, dateTime, jobStatus, complaints
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.jobOrder.create({
        data: {
          jobNo,
          customerPhone,
          serviceType,
          dateTime: dateTime ? new Date(dateTime) : new Date(),
          jobStatus: jobStatus || "Vehicle Received",
          createdAt: new Date(),
          updatedAt: new Date(),
          customer: customerId ? { connect: { id: customerId } } : undefined,
          vehicle: vehicleId ? { connect: { id: vehicleId } } : undefined,
          branch: branchId ? { connect: { id: branchId } } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined,
          complaint: complaints && complaints.length > 0 ? {
            create: complaints.map(c => ({
              complaint: c.complaint,
              jobStatus: c.jobStatus || "VEHICLERECEIVED",
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: user ? { connect: { id: user } } : undefined
            }))
          } : undefined
        },
        include: this.jobOrderInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Job Order created",
          data: created
        }
      });
    } catch (err) {
      logger.error("Create job order error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const jobOrder = await prisma.jobOrder.findUnique({
        where: { id },
        include: this.jobOrderInclude
      });

      if (jobOrder) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "Job order fetched",
            data: jobOrder
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one job order error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString } = req.body;
      const branchIds = req.user?.branch || [];
      const skip = (page - 1) * size;
      const inputValue = searchString || "";
      const tCased = await titleCase(inputValue);

      const where = {
        branchId: { in: Array.isArray(branchIds) ? branchIds : [branchIds] },
        OR: [
          { jobNo: { contains: inputValue, mode: 'insensitive' } },
          { customerPhone: { contains: inputValue, mode: 'insensitive' } },
          { customer: { name: { contains: inputValue, mode: 'insensitive' } } },
          { customer: { name: { contains: tCased, mode: 'insensitive' } } },
          { vehicle: { registerNo: { contains: inputValue, mode: 'insensitive' } } }
        ]
      };

      const [jobOrders, count] = await Promise.all([
        prisma.jobOrder.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.jobOrderInclude
        }),
        prisma.jobOrder.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Job Orders fetched",
          data: { count, jobOrder: jobOrders }
        }
      });
    } catch (err) {
      logger.error("Get job order page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  setStatus = async (req, res) => {
    try {
      const { jobOrderId, type } = req.body;
      
      const updated = await prisma.jobOrder.update({
        where: { id: jobOrderId },
        data: { jobStatus: type },
        include: this.jobOrderInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Status updated",
          data: updated
        }
      });
    } catch (err) {
      logger.error("Set status error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };
}

export default new JobOrderController();

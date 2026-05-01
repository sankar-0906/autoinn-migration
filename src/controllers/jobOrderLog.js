import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Job Order Log operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class JobOrderLogController {
  // Shared include object to mirror the legacy fragment
  logInclude = {
    jobOrder: {
      include: {
        customer: true,
        vehicle: true
      }
    },
    createdBy: {
      include: { profile: true }
    }
  };

  createJobOrderLog = async (req, res) => {
    try {
      const { jobOrderId, event, remarks } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.jobOrderLog.create({
        data: {
          event,
          remarks,
          createdAt: new Date(),
          updatedAt: new Date(),
          jobOrder: { connect: { id: jobOrderId } },
          createdBy: user ? { connect: { id: user } } : undefined
        },
        include: this.logInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Job order log created",
          data: created
        }
      });
    } catch (err) {
      logger.error("Create job order log error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getLogs = async (req, res) => {
    try {
      const { id } = req.params; // jobOrderId
      const logs = await prisma.jobOrderLog.findMany({
        where: { jobOrderId: id },
        orderBy: { createdAt: 'desc' },
        include: this.logInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "jobOrderLogs fetched",
          data: logs
        }
      });
    } catch (err) {
      logger.error("Get logs error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString } = req.body;
      const skip = (page - 1) * size;
      const inputValue = searchString || "";
      const tCased = await titleCase(inputValue);

      const where = {
        OR: [
          { event: { contains: inputValue, mode: 'insensitive' } },
          { jobOrder: { jobNo: { contains: inputValue, mode: 'insensitive' } } },
          { jobOrder: { customer: { name: { contains: inputValue, mode: 'insensitive' } } } },
          { jobOrder: { customer: { name: { contains: tCased, mode: 'insensitive' } } } }
        ]
      };

      const [logs, count] = await Promise.all([
        prisma.jobOrderLog.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.logInclude
        }),
        prisma.jobOrderLog.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "JobOrderLogs fetched",
          data: { count, JobOrderLog: logs } // Note: Key name matches legacy
        }
      });
    } catch (err) {
      logger.error("Get log page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };
}

export default new JobOrderLogController();

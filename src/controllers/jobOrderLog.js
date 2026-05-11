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
    JobOrder: {
      include: {
        customer: true,
        vehicle: true
      }
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
          JobOrder: { connect: { id: jobOrderId } }
        },
        include: this.logInclude
      });

      const { JobOrder, ...rest } = created;
      const formattedLog = { ...rest, jobOrder: JobOrder };

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Job order log created",
          data: formattedLog
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
        where: { jobOrder: id },
        orderBy: { createdAt: 'desc' },
        include: this.logInclude
      });

      // Parity: Fetch TeleCMICallHistory bucketURL and map JobOrder to jobOrder
      const formattedLogs = logs.map(log => {
        const { JobOrder, ...rest } = log;
        return { ...rest, jobOrder: JobOrder };
      });

      for (let i = 0; i < formattedLogs.length; i++) {
        const callHistory = await prisma.teleCMICallHistory.findFirst({
          where: { activityId: formattedLogs[i].id },
          select: { bucketURL: true }
        });
        if (callHistory && callHistory.bucketURL) {
          formattedLogs[i].data = callHistory.bucketURL;
        }
      }

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "jobOrderLogs fetched",
          data: formattedLogs
        }
      });
    } catch (err) {
      logger.error("Get logs error:", err);
      return res.json({ code: 500, response: { code: 500, message: "an error occurred" } });
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
          { JobOrder: { jobNo: { contains: inputValue, mode: 'insensitive' } } },
          { JobOrder: { customer: { name: { contains: inputValue, mode: 'insensitive' } } } },
          { JobOrder: { customer: { name: { contains: tCased, mode: 'insensitive' } } } }
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

      // Map JobOrder to jobOrder for each log
      const formattedLogs = logs.map(log => {
        const { JobOrder, ...rest } = log;
        return { ...rest, jobOrder: JobOrder };
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "JobOrderLogs fetched",
          data: { count, JobOrderLog: formattedLogs } // Note: Key name matches legacy
        }
      });
    } catch (err) {
      logger.error("Get log page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };
}

export default new JobOrderLogController();

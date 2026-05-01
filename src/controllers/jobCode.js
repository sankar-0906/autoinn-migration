import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Job Code operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class JobCodeController {
  // Shared include object for JobCode
  jobCodeInclude = {
    vehicleModel: {
      include: { vehicle: true }
    },
    sac: true
  };

  createJobCode = async (req, res) => {
    try {
      const {
        code, description, group, vehicleModel,
        sac, marginType, marginOnOutsideWork, consumable
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.jobCode.create({
        data: {
          code,
          description,
          group,
          consumable: consumable === 'true' || consumable === true,
          marginType,
          marginOnOutsideWork,
          createdAt: new Date(),
          updatedAt: new Date(),
          sac: sac ? { connect: { id: sac } } : undefined,
          vehicleModel: vehicleModel && vehicleModel.length > 0 ? {
            create: vehicleModel.map(v => ({
              vehicle: { connect: { id: v.vehicle.id } },
              price: parseFloat(v.price) || 0,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined
        },
        include: this.jobCodeInclude
      });

      return res.json({
        code: 200,
        response: created
      });
    } catch (err) {
      logger.error("Create job code error:", err);
      return res.json({ code: 500, msg: "An error occured", err });
    }
  };

  getAll = async (req, res) => {
    try {
      const jobCodes = await prisma.jobCode.findMany({
        include: this.jobCodeInclude
      });

      return res.json({
        code: 200,
        response: jobCodes
      });
    } catch (err) {
      logger.error("Get all job codes error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const jobCode = await prisma.jobCode.findUnique({
        where: { id },
        include: this.jobCodeInclude
      });

      if (jobCode) {
        return res.json({
          code: 200,
          response: jobCode
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one job code error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString } = req.body;
      const skip = (page - 1) * size;
      const inputValue = searchString || "";

      const where = {
        OR: [
          { code: { contains: inputValue, mode: 'insensitive' } },
          { description: { contains: inputValue, mode: 'insensitive' } }
        ]
      };

      const [jobCodes, count] = await Promise.all([
        prisma.jobCode.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.jobCodeInclude
        }),
        prisma.jobCode.count({ where })
      ]);

      return res.json({
        code: 200,
        response: { count, jobCode: jobCodes }
      });
    } catch (err) {
      logger.error("Get job code page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };
}

export default new JobCodeController();

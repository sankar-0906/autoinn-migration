import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Sold Vehicle operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class SoldVehicleController {
  // Shared include object for SoldVehicle
  soldInclude = {
    vehicle: {
      include: { manufacturer: true, file: true }
    },
    customer: {
      include: { customer: true }
    },
    color: true,
    insurance: {
      include: { insurance: true, file: true }
    },
    services: true,
    jobOrder: true
  };

  getAll = async (req, res) => {
    try {
      const vehicles = await prisma.soldVehicle.findMany({
        include: this.soldInclude
      });

      return res.json({
        code: 200,
        response: vehicles
      });
    } catch (err) {
      logger.error("Get all sold vehicles error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const vehicle = await prisma.soldVehicle.findUnique({
        where: { id },
        include: this.soldInclude
      });

      if (vehicle) {
        return res.json({
          code: 200,
          response: vehicle
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one sold vehicle error:", err);
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
        OR: [
          { registerNo: { contains: inputValue, mode: 'insensitive' } },
          { chassisNo: { contains: inputValue, mode: 'insensitive' } },
          { engineNo: { contains: inputValue, mode: 'insensitive' } },
          { customer: { customer: { name: { contains: inputValue, mode: 'insensitive' } } } }
        ]
      };

      const [vehicles, count] = await Promise.all([
        prisma.soldVehicle.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.soldInclude
        }),
        prisma.soldVehicle.count({ where })
      ]);

      return res.json({
        code: 200,
        response: { count, soldVehicle: vehicles }
      });
    } catch (err) {
      logger.error("Get sold vehicle page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  getByRegNum = async (req, res) => {
    try {
      const { id } = req.params; // registerNo
      const vehicle = await prisma.soldVehicle.findFirst({
        where: { registerNo: id },
        include: this.soldInclude
      });

      return res.json({
        code: 200,
        response: vehicle
      });
    } catch (err) {
      logger.error("Get by reg num error:", err);
      return res.json({ code: 500, message: "Server error" });
    }
  };
}

export default new SoldVehicleController();

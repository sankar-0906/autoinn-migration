import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for RTO (Regional Transport Office).
 * Maintained with 100% payload parity with autoinn-be.
 */
class RtoController {
  // Shared include object to mirror the legacy fragment
  rtoInclude = {
    City: {
      include: {
        State: {
          include: {
            Country: true
          }
        }
      }
    }
  };

  /**
   * Helper to format RTO object to match legacy fragment structure
   * Legacy format: { city: { id, name, state: { id, name } } }
   * Prisma 7 format: { City: { id, name, State: { id, name } } }
   */
  formatRto(rto) {
    if (!rto) return null;
    const { City, ...rest } = rto;
    return {
      ...rest,
      city: City ? {
        id: City.id,
        name: City.name,
        state: City.State ? {
          id: City.State.id,
          name: City.State.name
        } : null
      } : null
    };
  }

  createRto = async (req, res) => {
    try {
      const { code, area, city } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      // Check if RTO code exists
      const existingRto = await prisma.rto.findFirst({
        where: { code }
      });

      if (existingRto) {
        return res.json({ code: 500, msg: "RTO code already exists" });
      }

      const created = await prisma.rto.create({
        data: {
          code,
          area,
          city: city, // connecting by id directly as it's a scalar in our schema if it's @db.VarChar(25)
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        include: this.rtoInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "rto created successfully",
          data: this.formatRto(created),
        }
      });
    } catch (err) {
      logger.error("Error creating RTO:", err);
      return res.json({
        code: 500,
        msg: "An error occured",
        err: err.message
      });
    }
  };

  getAll = async (req, res) => {
    try {
      const rtos = await prisma.rto.findMany({
        include: this.rtoInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Rtos fetched",
          data: rtos.map(r => this.formatRto(r)),
        }
      });
    } catch (err) {
      logger.error("Error getting all RTOs:", err);
      return res.json({
        code: 500,
        msg: "An error occured",
      });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const rto = await prisma.rto.findUnique({
        where: { id },
        include: this.rtoInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "rto fetched",
          data: this.formatRto(rto),
        }
      });
    } catch (err) {
      logger.error("Error getting one RTO:", err);
      return res.json({
        code: 500,
        message: "Server error, Please check the logs",
      });
    }
  };

  deleteRto = async (req, res) => {
    try {
      const { id } = req.params;
      // HARD delete as per legacy logic
      await prisma.rto.delete({
        where: { id },
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "rto deleted permanently",
        }
      });
    } catch (err) {
      logger.error("Error deleting RTO:", err);
      return res.json({
        code: 500,
        msg: "An error occured",
      });
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
          { code: { contains: inputValue, mode: "insensitive" } },
          { code: { contains: tCased, mode: "insensitive" } },
          { area: { contains: inputValue, mode: "insensitive" } }
        ]
      };

      const [rtos, count] = await Promise.all([
        prisma.rto.findMany({
          where,
          take: size,
          skip,
          include: this.rtoInclude
        }),
        prisma.rto.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "RTOs  fetched",
          data: { 
            count, 
            rto: rtos.map(r => this.formatRto(r)) 
          },
        }
      });
    } catch (err) {
      logger.error("Error getting RTO page:", err);
      return res.json({
        code: 500,
        message: "error getting all rtos",
      });
    }
  };

  updateRto = async (req, res) => {
    try {
      const { id } = req.params;
      const { code, area, city } = req.body;

      const updated = await prisma.rto.update({
        where: { id },
        data: {
          code,
          area,
          city: city,
          updatedAt: new Date(),
        },
        include: this.rtoInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Rto updated",
          data: this.formatRto(updated),
        }
      });
    } catch (err) {
      logger.error("Error updating RTO:", err);
      return res.json({
        code: 500,
        message: "error updating all Rtos",
      });
    }
  };
}

export default new RtoController();

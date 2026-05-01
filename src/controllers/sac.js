import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";

/**
 * Controller for SAC (Services Accounting Code).
 * Maintained with 100% payload parity with autoinn-be.
 */
class SacController {
  createSac = async (req, res) => {
    try {
      const { code, igst, cgst, sgst, cess, description } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      if (!user) {
         return res.json({ code: 500, msg: "User ID required" });
      }

      const createSac = await prisma.sac.create({
        data: {
          code: code.toString(),
          igst,
          cgst,
          sgst,
          cess,
          description,
          createdAt: new Date(),
          updatedAt: new Date(),
          User: {
            connect: { id: user },
          },
        },
      });

      if (createSac) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "SAC created",
            data: createSac,
          }
        });
      }
    } catch (err) {
      logger.error("Error creating SAC:", err);
      return res.json({
        code: 500,
        msg: "An error occured",
        err: err.message,
      });
    }
  };

  getAll = async (req, res) => {
    try {
      const sac = await prisma.sac.findMany();
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "All sacs fetched",
          data: sac,
        }
      });
    } catch (err) {
      logger.error("Error getting all SAC:", err);
      return res.json({
        code: 500,
        msg: "An error occured",
      });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const sac = await prisma.sac.findUnique({
        where: { id },
      });
      if (sac) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "sac fetched",
            data: sac,
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Error getting one SAC:", err);
      return res.json({
        code: 500,
        message: "Server error, Please check the logs",
      });
    }
  };

  updateSac = async (req, res) => {
    try {
      const { id } = req.params;
      const { code, igst, cgst, sgst, cess, description } = req.body;
      const updateSac = await prisma.sac.update({
        where: { id },
        data: {
          code: code?.toString(),
          igst,
          cgst,
          sgst,
          cess,
          description,
          updatedAt: new Date(),
        },
      });
      if (updateSac) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "SAC updated",
            data: updateSac,
          }
        });
      }
    } catch (err) {
      logger.error("Error updating SAC:", err);
      return res.json({
        code: 500,
        msg: "An error occured",
      });
    }
  };

  deleteSac = async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.sac.delete({
        where: { id },
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "SAC deleted permanently.",
        }
      });
    } catch (err) {
      logger.error("Error deleting SAC:", err);
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

      const where = {
        OR: [
          { code: { contains: inputValue, mode: "insensitive" } },
        ],
      };

      const [sac, count] = await Promise.all([
        prisma.sac.findMany({
          where,
          take: size,
          skip,
        }),
        prisma.sac.count({ where }),
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "SACs fetched",
          data: { count, sac },
        }
      });
    } catch (err) {
      logger.error("Error getting SAC page:", err);
      return res.json({
        code: 500,
        msg: "an error occurred",
      });
    }
  };
}

export default new SacController();

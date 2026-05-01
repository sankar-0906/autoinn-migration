import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";

/**
 * Controller for HSN (Harmonized System of Nomenclature).
 * Maintained with 100% payload parity with autoinn-be.
 */
class HsnController {
  createHsn = async (req, res) => {
    try {
      const { code, igst, cgst, sgst, cess, description } = req.body;
      const user = req.user?.id || req.headers["user-id"]; // Fallback for testing

      if (!user) {
        return res.json({ code: 500, msg: "User ID required" });
      }

      const createHsn = await prisma.hsn.create({
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

      if (createHsn) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "HSN created",
            data: createHsn,
          }
        });
      }
    } catch (err) {
      logger.error("Error creating HSN:", err);
      return res.json({
        code: 500,
        msg: "An error occured",
        err: err.message,
      });
    }
  };

  getAll = async (req, res) => {
    try {
      const hsn = await prisma.hsn.findMany();
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "All hsns fetched",
          data: hsn,
        }
      });
    } catch (err) {
      logger.error("Error getting all HSN:", err);
      return res.json({
        code: 500,
        msg: "An error occured",
      });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const hsn = await prisma.hsn.findUnique({
        where: { id },
      });
      if (hsn) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "hsn fetched",
            data: hsn,
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Error getting one HSN:", err);
      return res.json({
        code: 500,
        message: "Server error, Please check the logs",
      });
    }
  };

  updateHsn = async (req, res) => {
    try {
      const { id } = req.params;
      const { code, igst, cgst, sgst, cess, description } = req.body;
      const updateHsn = await prisma.hsn.update({
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
      if (updateHsn) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "HSN updated",
            data: updateHsn,
          }
        });
      }
    } catch (err) {
      logger.error("Error updating HSN:", err);
      return res.json({
        code: 500,
        msg: "An error occured",
      });
    }
  };

  deleteHsn = async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.hsn.delete({
        where: { id },
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "HSN deleted permanently.",
        }
      });
    } catch (err) {
      logger.error("Error deleting HSN:", err);
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

      const [hsn, count] = await Promise.all([
        prisma.hsn.findMany({
          where,
          take: size,
          skip,
        }),
        prisma.hsn.count({ where }),
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "HSNs fetched",
          data: { count, hsn },
        }
      });
    } catch (err) {
      logger.error("Error getting HSN page:", err);
      return res.json({
        code: 500,
        msg: "an error occurred",
      });
    }
  };
}

export default new HsnController();

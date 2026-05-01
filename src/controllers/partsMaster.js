import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";
import moment from "moment";

/**
 * Controller for Parts Master operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class PartsMasterController {
  // Shared include object to mirror the legacy fragment
  partInclude = {
    hsn: true,
    manufacturer: true,
    vehicleSuit: {
      include: {
        vehicle: true
      }
    }
  };

  createPartsMaster = async (req, res) => {
    try {
      const {
        number, name, oldPartNum, category, largeCategoryName,
        showInConsumer, showInAutoCloud, url, color, moq, mrp, ndp,
        hsn, manufacturer, size, mainPartNumber, wefDate, partStatus,
        vehicleSuit, displayName, remarks
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.partsMaster.create({
        data: {
          partName: name,
          partNumber: number,
          oldPartNum,
          displayName,
          category: category ? category.toUpperCase() : undefined,
          largeCategoryName,
          showInConsumer: showInConsumer === 'true' || showInConsumer === true,
          showInAutoCloud: showInAutoCloud === 'true' || showInAutoCloud === true,
          url: url ? { set: Array.isArray(url) ? url : [url] } : undefined,
          color,
          moq: parseInt(moq) || 1,
          mrp: parseFloat(mrp) || 0,
          ndp: parseFloat(ndp) || 0,
          size,
          mainPartNumber,
          wefDate: wefDate ? moment(wefDate, "DD-MM-YYYY").toDate() : undefined,
          partStatus,
          remarks,
          createdAt: new Date(),
          updatedAt: new Date(),
          hsn: hsn ? { connect: { id: hsn } } : undefined,
          manufacturer: manufacturer ? { connect: { id: manufacturer } } : undefined,
          vehicleSuit: vehicleSuit && vehicleSuit.length > 0 ? {
            create: vehicleSuit.map(v => ({
              vehicle: { connect: { id: v } },
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined
        },
        include: this.partInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Parts Master created",
          data: created
        }
      });
    } catch (err) {
      logger.error("Create parts master error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getAll = async (req, res) => {
    try {
      const parts = await prisma.partsMaster.findMany({
        include: this.partInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "parts master fetched",
          data: parts
        }
      });
    } catch (err) {
      logger.error("Get all parts master error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const part = await prisma.partsMaster.findUnique({
        where: { id },
        include: this.partInclude
      });

      if (part) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "parts master fetched",
            data: part
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one parts master error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
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
          { partName: { contains: inputValue, mode: 'insensitive' } },
          { partNumber: { contains: inputValue, mode: 'insensitive' } },
          { partName: { contains: tCased, mode: 'insensitive' } }
        ]
      };

      const [parts, count] = await Promise.all([
        prisma.partsMaster.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.partInclude
        }),
        prisma.partsMaster.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Parts Master  fetched",
          data: { count, partsMaster: parts }
        }
      });
    } catch (err) {
      logger.error("Get parts master page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  getAccessories = async (req, res) => {
    try {
      const { searchString } = req.query;
      const inputValue = searchString || "";

      const accessories = await prisma.partsMaster.findMany({
        where: {
          category: "ACCESSORIES",
          OR: [
            { partName: { contains: inputValue, mode: 'insensitive' } },
            { partNumber: { contains: inputValue, mode: 'insensitive' } }
          ]
        },
        include: this.partInclude
      });

      return res.json({
        response: accessories
      });
    } catch (err) {
      logger.error("Get accessories error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };
}

export default new PartsMasterController();

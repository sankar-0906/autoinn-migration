import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";
import moment from "moment";
import Excel from "exceljs";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        VehicleMaster: true
      }
    }
  };

  /**
   * Helper to format PartsMaster object to match legacy fragment structure.
   */
  formatPart = (p) => {
    if (!p) return p;
    return {
      ...p,
      vehicleSuit: (p.vehicleSuit || []).map(suit => ({
        ...suit,
        vehicle: suit.VehicleMaster || null
      }))
    };
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
          wefDate: wefDate ? (moment(wefDate, "DD-MM-YYYY").isValid() ? moment(wefDate, "DD-MM-YYYY").toDate() : moment(wefDate).toDate()) : undefined,
          partStatus,
          remarks,
          createdAt: new Date(),
          updatedAt: new Date(),
          hsn: hsn ? { connect: { id: hsn } } : undefined,
          manufacturer: manufacturer ? { connect: { id: manufacturer } } : undefined,
          vehicleSuit: vehicleSuit && vehicleSuit.length > 0 ? {
            create: vehicleSuit.map(v => ({
              VehicleMaster: { connect: { id: typeof v === 'object' ? v.vehicle : v } },
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
          data: this.formatPart(created)
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
          data: parts.map(p => this.formatPart(p))
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
      
      // Safety check for common frontend 'undefined' strings
      if (!id || id === "undefined" || id === "null") {
        return res.status(404).json({ code: 404, message: "Invalid part ID" });
      }

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
            data: this.formatPart(part)
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error(`Get one parts master error for ID ${req.params.id}:`, err);
      return res.status(500).json({ code: 500, message: "Server error", error: err.message });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString } = req.body;
      const userBranch = req.user?.branch || [];
      const parsedPage = parseInt(page) || 1;
      const parsedSize = parseInt(size) || 10;
      const skip = (parsedPage - 1) * parsedSize;
      const inputValue = searchString || "";
      const tCased = await titleCase(inputValue);

      // Robust Branch/Manufacturer filtering logic
      let branchIds = req.user?.branch || [];
      const userId = req.user?.id || req.headers["user-id"];

      if ((!branchIds || (Array.isArray(branchIds) && branchIds.length === 0)) && userId) {
        const userWithBranches = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            EmployeeProfile_User_profileToEmployeeProfile: { include: { branch: true } },
            branches: true
          }
        });
        if (userWithBranches) {
          const profileBranches = userWithBranches.EmployeeProfile_User_profileToEmployeeProfile?.branch?.map(b => b.id) || [];
          const userBranches = userWithBranches.branches?.map(b => b.id) || [];
          branchIds = [...new Set([...profileBranches, ...userBranches])];
        }
      }

      const branches = await prisma.branch.findMany({
        where: { id: { in: Array.isArray(branchIds) ? branchIds : [branchIds] } },
        include: { manufacturer: true }
      });
      const manufacturerIds = branches.flatMap(b => b.manufacturer.map(m => m.id));

      const where = {
        manufacturerId: { in: manufacturerIds },
        OR: [
          { partName: { contains: inputValue, mode: 'insensitive' } },
          { partNumber: { contains: inputValue, mode: 'insensitive' } },
          { partName: { contains: tCased, mode: 'insensitive' } }
        ]
      };

      const [parts, count] = await Promise.all([
        prisma.partsMaster.findMany({
          where,
          take: parsedSize,
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
          msg: "Parts Masters  fetched",
          data: { count, partsMaster: parts.map(p => this.formatPart(p)) }
        }
      });
    } catch (err) {
      logger.error("Get parts master page error:", err);
      return res.json({ code: 500, msg: "an error occurred", error: err.message, stack: err.stack });
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
        response: accessories.map(p => this.formatPart(p))
      });
    } catch (err) {
      logger.error("Get accessories error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  template = async (req, res) => {
    try {
      const workbook = new Excel.Workbook();
      const sheet = workbook.addWorksheet("Part_Master_Download");

      sheet.columns = [
        { header: "Part Number", key: "partNumber" },
        { header: "Part Name", key: "partName" },
        { header: "Old Part Num", key: "oldPartNum" },
        { header: "Category", key: "category" },
        { header: "Large Category Name", key: "largeCategoryName" },
        { header: "Colour", key: "color" },
        { header: "MOQ", key: "moq" },
        { header: "MRP", key: "mrp" },
        { header: "NDP", key: "ndp" },
        { header: "HSN (Mandatory)", key: "hsn" },
        { header: "CGST", key: "cgst" },
        { header: "SGST", key: "sgst" },
        { header: "IGST", key: "igst" },
        { header: "CESS", key: "cess" },
        { header: "Bin Number", key: "binNUm" },
        { header: "Min Stock", key: "minStock" },
        { header: "Max Stock", key: "maxStock" },
      ];

      const uploadDir = path.join(__dirname, "../../uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, "PartsMaster.xlsx");
      await workbook.xlsx.writeFile(filePath);

      return res.json({
        code: 200,
        response: "/uploads/PartsMaster.xlsx"
      });
    } catch (err) {
      logger.error("Parts master template error:", err);
      return res.status(500).json({ code: 500, message: "Server error, Please check the logs" });
    }
  };

  updatePartsMaster = async (req, res) => {
    try {
      const { id } = req.params;
      const {
        number, name, oldPartNum, category, largeCategoryName,
        showInConsumer, showInAutoCloud, url, color, moq, mrp, ndp,
        hsn, manufacturer, size, mainPartNumber, wefDate, partStatus,
        vehicleSuit, displayName, remarks
      } = req.body;

      const updated = await prisma.partsMaster.update({
        where: { id },
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
          moq: parseInt(moq) || undefined,
          mrp: parseFloat(mrp) || undefined,
          ndp: parseFloat(ndp) || undefined,
          size,
          mainPartNumber,
          wefDate: wefDate ? (moment(wefDate, "DD-MM-YYYY").isValid() ? moment(wefDate, "DD-MM-YYYY").toDate() : moment(wefDate).toDate()) : undefined,
          partStatus,
          remarks,
          updatedAt: new Date(),
          hsn: hsn ? { connect: { id: hsn } } : undefined,
          manufacturer: manufacturer ? { connect: { id: manufacturer } } : undefined,
          vehicleSuit: vehicleSuit && vehicleSuit.length > 0 ? {
            deleteMany: {}, // Simplest way to "upsert" is delete and recreate for this relation
            create: vehicleSuit.map(v => ({
              VehicleMaster: { connect: { id: typeof v === 'object' ? v.vehicle : v } },
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          } : undefined
        },
        include: this.partInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "PartsMaster updated",
          data: this.formatPart(updated)
        }
      });
    } catch (err) {
      logger.error("Update parts master error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  deletePartsMaster = async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.partsMaster.delete({ where: { id } });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "PartsMaster deleted permanently."
        }
      });
    } catch (err) {
      logger.error("Delete parts master error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };
}

export default new PartsMasterController();

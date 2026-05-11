import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";
import Excel from "exceljs";
import path from "path";
import fs from "fs";

/**
 * Controller for Job Code operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class JobCodeController {
  // Shared include object for JobCode
  jobCodeInclude = {
    JobCodePrice: {
      include: { vehicle: true }
    },
    sac: true
  };

  /**
   * Helper to format JobCode to match legacy structure
   */
  formatJobCode = (j) => {
    if (!j) return j;
    return {
      ...j,
      vehicleModel: (j.JobCodePrice || []).map(p => ({
        ...p,
        vehicle: p.vehicle || null
      }))
    };
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
          JobCodePrice: vehicleModel && vehicleModel.length > 0 ? {
            create: vehicleModel.map(v => ({
              vehicle: { connect: { id: v.vehicle?.id || v.vehicle } },
              price: parseFloat(v.price) || 0,
            }))
          } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined
        },
        include: this.jobCodeInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "JobCode created",
          data: this.formatJobCode(created)
        }
      });
    } catch (err) {
      logger.error("Create job code error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  updateJobCode = async (req, res) => {
    try {
      const { id } = req.params;
      const {
        code, description, group, vehicleModel,
        sac, marginType, marginOnOutsideWork, consumable
      } = req.body;

      const updated = await prisma.jobCode.update({
        where: { id },
        data: {
          code,
          description,
          group,
          consumable: consumable === 'true' || consumable === true,
          marginType,
          marginOnOutsideWork,
          updatedAt: new Date(),
          sac: sac ? { connect: { id: sac } } : undefined,
          JobCodePrice: vehicleModel && vehicleModel.length > 0 ? {
            deleteMany: {}, // Clear existing models
            create: vehicleModel.map(v => ({
              vehicle: { connect: { id: v.vehicle?.id || v.vehicle } },
              price: parseFloat(v.price) || 0,
            }))
          } : undefined
        },
        include: this.jobCodeInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "JobCode updated",
          data: this.formatJobCode(updated)
        }
      });
    } catch (err) {
      logger.error("Update job code error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  deleteJobCode = async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.jobCode.delete({ where: { id } });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "JobCode deleted permanently."
        }
      });
    } catch (err) {
      logger.error("Delete job code error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getAll = async (req, res) => {
    try {
      const jobCodes = await prisma.jobCode.findMany({
        include: this.jobCodeInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "JobCodes fetched",
          data: jobCodes.map(j => this.formatJobCode(j))
        }
      });
    } catch (err) {
      logger.error("Get all job codes error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      if (!id || id === "undefined" || id === "null" || id === "template") {
        return res.status(404).json({ code: 404, message: "Invalid ID" });
      }

      const jobCode = await prisma.jobCode.findUnique({
        where: { id },
        include: this.jobCodeInclude
      });

      if (jobCode) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "JobCode fetched",
            data: this.formatJobCode(jobCode)
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one job code error:", err);
      return res.json({ code: 500, message: "Server error" });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString } = req.body;
      const parsedPage = parseInt(page) || 1;
      const parsedSize = parseInt(size) || 10;
      const skip = (parsedPage - 1) * parsedSize;
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
          take: parsedSize,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.jobCodeInclude
        }),
        prisma.jobCode.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "JobCodes fetched",
          data: { count, jobCode: jobCodes.map(j => this.formatJobCode(j)) }
        }
      });
    } catch (err) {
      logger.error("Get job code page error:", err);
      return res.json({ code: 500, msg: "an error occurred", error: err.message });
    }
  };

  template = async (req, res) => {
    try {
      const workbook = new Excel.Workbook();
      const sheet1 = workbook.addWorksheet("Sheet1");
      
      await sheet1.addRow(["Code"]);
      await sheet1.addRow(["Description"]);
      await sheet1.addRow(["Job Group (Specify in capital letters without whitespace)"]);
      await sheet1.addRow(["SAC Code"]);
      await sheet1.addRow(["CGST"]);
      await sheet1.addRow(["SGST"]);
      await sheet1.addRow(["IGST"]);
      await sheet1.addRow(["Cess"]);
      await sheet1.addRow(["Margin Type"]);
      await sheet1.addRow(["Margin On Outside Work"]);
      await sheet1.addRow([""]);
      await sheet1.addRow([""]);
      await sheet1.addRow(["Vehicle Model Code", "Vehicle Model Name(Specify as in Database)", "Price (Specify corresponding to Vehicle model)"]);

      const uploadDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, "jobCodeTemplate.xlsx");
      await workbook.xlsx.writeFile(filePath);

      return res.json({
        code: 200,
        response: "/uploads/jobCodeTemplate.xlsx"
      });
    } catch (err) {
      logger.error("Job code template error:", err);
      return res.status(500).json({ code: 500, message: "Server error" });
    }
  };

  exportData = async (req, res) => {
    try {
      const workbook = new Excel.Workbook();
      const jobCodes = await prisma.jobCode.findMany({
        include: this.jobCodeInclude
      });

      const vehicles = await prisma.vehicleMaster.findMany();

      for (const jobCode of jobCodes) {
        let sheetName = jobCode.code || "Sheet";
        if (sheetName.length > 30) sheetName = sheetName.substring(0, 30);
        const sheet = workbook.addWorksheet(sheetName);

        await sheet.addRow(["Code", jobCode.code]);
        await sheet.addRow(["Description", jobCode.description]);
        await sheet.addRow(["Job Group", jobCode.group]);
        await sheet.addRow(["Sac Code", jobCode.sac?.code || ""]);
        await sheet.addRow(["CGST", jobCode.sac?.cgst || ""]);
        await sheet.addRow(["SGST", jobCode.sac?.sgst || ""]);
        await sheet.addRow(["IGST", jobCode.sac?.igst || ""]);
        await sheet.addRow(["Cess", jobCode.sac?.cess || ""]);
        await sheet.addRow(["Margin Type", jobCode.marginType]);
        await sheet.addRow(["Margin On Outside Work", jobCode.marginOnOutsideWork]);
        await sheet.addRow(["", ""]);
        await sheet.addRow(["", ""]);
        await sheet.addRow(["Vehicle Model Code", "Vehicle Model Name", "Price"]);

        const pricesMap = new Map();
        (jobCode.JobCodePrice || []).forEach(vm => {
          if (vm.vehicle) pricesMap.set(vm.vehicle.id, vm.price);
        });

        for (const v of vehicles) {
          const price = pricesMap.get(v.id) || 0;
          await sheet.addRow([v.modelCode, v.modelName, price]);
        }
      }

      const uploadDir = path.join(process.cwd(), "uploads");
      const filePath = path.join(uploadDir, "JobCodeExport.xlsx");
      await workbook.xlsx.writeFile(filePath);

      return res.json({
        code: 200,
        response: "/uploads/JobCodeExport.xlsx"
      });
    } catch (err) {
      logger.error("Job code export error:", err);
      return res.status(500).json({ code: 500, message: "Server error" });
    }
  };

  getJobCodes = async (req, res) => {
    try {
      const { page, size } = req.body;
      const skip = (parseInt(page) - 1) * parseInt(size || 10);
      const take = parseInt(size || 10);

      const jobCodes = await prisma.jobCode.findMany({
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: this.jobCodeInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "JobCodes fetched",
          data: jobCodes.map(j => this.formatJobCode(j))
        }
      });
    } catch (err) {
      logger.error("Get job codes list error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };
}

export default new JobCodeController();

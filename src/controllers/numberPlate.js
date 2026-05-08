import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import { nanoid } from "nanoid";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs/promises";
import pdf from "pdf-parse";
import moment from "moment";
import uploadController from "./upload.js";

/**
 * Controller for Number Plate operations.
 * Ported from legacy NumberPlate route logic.
 */
class NumberPlateController {
  
  check = async (req, res) => {
    return res.json("CONNECTED");
  };

  /**
   * Get all number plates with pagination and filters
   */
  get = async (req, res) => {
    try {
      const { page = 1, size = 10, status, startDate, endDate, branch, searchString = "" } = req.body;
      const skip = (page - 1) * size;

      const where = {
        OR: [
          { chassisNo: { contains: searchString, mode: 'insensitive' } },
          { registerNo: { contains: searchString, mode: 'insensitive' } },
          { customerName: { contains: searchString, mode: 'insensitive' } },
          { modelName: { contains: searchString, mode: 'insensitive' } },
        ],
        Location: branch ? { id: branch } : undefined,
        plateOrderStatus: (status && status !== "ALL") ? status : undefined,
        createdAt: (startDate || endDate) ? {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined
        } : undefined
      };

      const [numberPlates, count] = await Promise.all([
        prisma.numberPlate.findMany({
          where,
          include: {
            Location: true
          },
          take: size,
          skip,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.numberPlate.count({ where })
      ]);

      // Parity with legacy Location object naming
      const formatted = numberPlates.map(np => ({
        ...np,
        // Location is already np.Location due to the include name
      }));

      return res.json({
        code: 200,
        message: "Number plates fetched successfully",
        data: { count, numberPlates: formatted }
      });
    } catch (err) {
      logger.error("Get number plates error:", err);
      return res.status(500).json({ code: 500, message: "An error occurred" });
    }
  };

  /**
   * Create or Update Number Plate
   */
  update = async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;

      const updateData = {};
      const fields = [
        "registerNo", "chassisNo", "engineNo", "applicationType", 
        "goodsCareerMGV", "makerName", "modelName", "customerName", 
        "dealershipName", "applicationNo", "plateOrderStatus", "eReceipt"
      ];

      fields.forEach(field => {
        if (data[field] !== undefined) updateData[field] = data[field];
      });

      if (data.images !== undefined) {
         updateData.images = Array.isArray(data.images) ? data.images : [data.images];
      }

      const numberPlate = await prisma.numberPlate.update({
        where: { id },
        data: updateData
      });

      return res.json({
        code: 200,
        message: "Number plate updated successfully",
        data: numberPlate
      });
    } catch (err) {
      logger.error("Update number plate error:", err);
      return res.status(500).json({ code: 500, message: "An error occurred" });
    }
  };

  /**
   * Delete Number Plate
   */
  remove = async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await prisma.numberPlate.delete({ where: { id } });
      return res.json({
        code: 200,
        message: "Number plate deleted successfully",
        data: deleted
      });
    } catch (err) {
      logger.error("Delete number plate error:", err);
      return res.status(500).json({ code: 500, message: "An error occurred" });
    }
  };

  /**
   * Update status to RECEIVED
   */
  statusReceived = async (req, res) => {
    try {
      const { registerNos, branchId } = req.body;

      if (!registerNos || !Array.isArray(registerNos) || registerNos.length === 0) {
        return res.status(400).json({ code: 400, message: "Please provide an array of registration numbers" });
      }
      if (!branchId) return res.status(400).json({ code: 400, message: "Branch ID is required" });

      const result = await prisma.$transaction(async (tx) => {
        const plates = await tx.numberPlate.findMany({
          where: { registerNo: { in: registerNos } }
        });

        if (plates.length === 0) throw new Error("No number plates found");

        const chassisNos = plates.map(p => p.chassisNo).filter(Boolean);

        // Update Plates
        await tx.numberPlate.updateMany({
          where: { id: { in: plates.map(p => p.id) } },
          data: {
            plateOrderStatus: "RECEIVED",
            receivedDate: new Date(),
            locationId: branchId
          }
        });

        // Update SaleRegister
        let saleUpdatedCount = 0;
        if (chassisNos.length > 0) {
          const updateSales = await tx.saleRegister.updateMany({
            where: { chassisNumber: { in: chassisNos } },
            data: { status: "NPR" }
          });
          saleUpdatedCount = updateSales.count;
        }

        return { platesCount: plates.length, saleUpdatedCount };
      });

      return res.json({
        code: 200,
        message: `Status updated to RECEIVED for ${result.platesCount} number plates and NPR for ${result.saleUpdatedCount} sale registers.`,
        data: { updatedNumberPlates: result.platesCount, updatedSaleRegisters: result.saleUpdatedCount }
      });
    } catch (err) {
      logger.error("Status received error:", err);
      return res.status(500).json({ code: 500, message: err.message || "An error occurred" });
    }
  };

  /**
   * Update status to FIXED
   */
  statusFixed = async (req, res) => {
    try {
      const { registerNo, images } = req.body;

      if (!registerNo) return res.status(400).json({ code: 400, message: "Registration number is required" });

      const plate = await prisma.numberPlate.findFirst({
        where: { registerNo }
      });

      if (!plate) return res.status(404).json({ code: 404, message: "Number plate not found" });

      const result = await prisma.$transaction(async (tx) => {
        const updateData = {
          plateOrderStatus: "FIXED",
          fixedDate: new Date()
        };
        if (images && Array.isArray(images)) updateData.images = images;

        const updatedPlate = await tx.numberPlate.update({
          where: { id: plate.id },
          data: updateData
        });

        let saleUpdated = null;
        if (plate.chassisNo) {
          saleUpdated = await tx.saleRegister.updateMany({
            where: { chassisNumber: plate.chassisNo },
            data: { status: "NPF" }
          });
        }

        return { updatedPlate, saleUpdated: !!saleUpdated?.count };
      });

      return res.json({
        code: 200,
        message: `Status updated to FIXED for ${registerNo}`,
        data: { numberPlate: result.updatedPlate, saleRegisterUpdated: result.saleUpdated }
      });
    } catch (err) {
      logger.error("Status fixed error:", err);
      return res.status(500).json({ code: 500, message: "An error occurred" });
    }
  };

  /**
   * Bulk Upload PDFs
   */
  upload = async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    try {
      const extractedFiles = await Promise.all(
        req.files.map(async (file) => {
          try {
            const pdfBuffer = await fs.readFile(file.path);
            const pdfResult = await pdf(pdfBuffer);
            const text = pdfResult.text;

            const receiptDateMatch = text.match(/Receipt\s*date:\s*([\d]{1,2}-[A-Za-z]{3}-\d{4})/);
            let registrationDate = null;
            if (receiptDateMatch) {
              registrationDate = moment(receiptDateMatch[1], "DD-MMM-YYYY").toDate();
            }

            const chassisMatch = text.match(/Chassis No:\s*([A-Z0-9]+)/);
            const appMatch = text.match(/RECEIPT\/APPL No:\s*[\w\/]+\/([\w\d]+)/);
            const vehicleMatch = text.match(/Vehicle No:\s*([\w\d]+)/);
            const receivedFromMatch = text.match(/Received From:\s*([A-Z\s.]+)\n/);

            return {
              file,
              pdfBuffer,
              chassisNo: chassisMatch ? chassisMatch[1].slice(0, 17) : "Not Found",
              appNo: appMatch ? appMatch[1] : "Not Found",
              vehicleNo: vehicleMatch ? vehicleMatch[1] : "Not Found",
              ownerName: receivedFromMatch ? receivedFromMatch[1].trim() : "Not Found",
              registrationDate,
              fileName: file.originalname,
            };
          } catch (err) {
            return { fileName: file.originalname, error: "Failed to parse PDF" };
          }
        })
      );

      const validFiles = extractedFiles.filter(f => !f.error && f.chassisNo !== "Not Found");
      const results = [];

      for (const f of validFiles) {
        // 1. Check if already exists
        const existing = await prisma.numberPlate.findFirst({ where: { chassisNo: f.chassisNo } });
        if (existing) {
          results.push({ fileName: f.fileName, status: "Already Uploaded", chassisNo: f.chassisNo });
          continue;
        }

        // 2. Find Sale Register
        const sale = await prisma.saleRegister.findFirst({ 
          where: { chassisNumber: f.chassisNo },
          include: { booking: { include: { branch: true } } }
        });

        if (!sale) {
          results.push({ fileName: f.fileName, status: "Sale Register Not Found", chassisNo: f.chassisNo });
          continue;
        }

        // 3. Find Vehicle to get Engine No
        const vehicle = await prisma.vehicle.findFirst({ where: { chassisNo: f.chassisNo } });
        const vm = vehicle ? await prisma.vehicleMaster.findUnique({ where: { id: vehicle.vehicleId } }) : null;

        // 4. Save file locally (matching project's current upload style)
        const uploadDir = path.join(process.cwd(), "uploads");
        await fs.mkdir(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, f.fileName);
        await fs.writeFile(filePath, f.pdfBuffer);
        const url = `/uploads/${f.fileName}`;

        // Create File Management record
        await prisma.fileManagement.create({
          data: {
            name: f.fileName,
            module: "NumberPlate",
            url,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        // 5. Create NumberPlate and update Sale Register
        await prisma.$transaction([
          prisma.numberPlate.create({
            data: {
              id: nanoid(20),
              registerNo: f.vehicleNo,
              chassisNo: f.chassisNo,
              engineNo: vehicle?.engineNo || null,
              applicationType: "NB",
              goodsCareerMGV: "M-Cycle/Scooter~2WN~PETROL",
              makerName: "INDIA YAMAHA MOTOR PVT LTD",
              modelName: vm?.modelName || null,
              customerName: f.ownerName,
              dealershipName: "PACER MOTORS PVT LTD",
              applicationNo: f.appNo,
              plateOrderStatus: "ORDERED",
              eReceipt: url,
              bookingId: sale.bookingId,
              branchName: sale.booking?.branch?.name,
              locationId: sale.booking?.branchId,
              registrationDate: f.registrationDate,
              orderedDate: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            }
          }),
          prisma.saleRegister.update({
            where: { id: sale.id },
            data: { status: "NPO" }
          }),
          // Update Vehicle
          prisma.vehicle.updateMany({
            where: { chassisNo: f.chassisNo },
            data: { 
              registerNo: f.vehicleNo,
              applicationNumber: f.appNo,
              eReceipt: url
            }
          })
        ]);

        results.push({ fileName: f.fileName, status: "New", chassisNo: f.chassisNo, vehicleNo: f.vehicleNo, appNo: f.appNo });
      }

      // Cleanup local files
      for (const file of req.files) {
        await fs.unlink(file.path);
      }

      // Generate Excel for new records
      const anyNew = results.some(r => r.status === "New");
      let base64Excel = null;

      if (anyNew) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Sheet 1");
        worksheet.addRow(["RC Number", "Chassis No", "Application No", "Owner Name"]);
        results.filter(r => r.status === "New").forEach(r => {
          worksheet.addRow([r.vehicleNo, r.chassisNo, r.appNo, r.ownerName]);
        });
        const buffer = await workbook.xlsx.writeBuffer();
        base64Excel = buffer.toString("base64");
      }

      return res.json({
        fileStatuses: results,
        xlsxBase64: base64Excel
      });
    } catch (err) {
      logger.error("Upload PDFs error:", err);
      return res.status(500).json({ error: "Failed to process PDFs" });
    }
  };
}

export default new NumberPlateController();

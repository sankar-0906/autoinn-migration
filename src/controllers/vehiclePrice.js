import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";
import moment from "moment";
import Excel from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Controller for Vehicle Price operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class VehiclePriceController {
  // Shared include object to mirror the legacy fragment
  priceInclude = {
    vehicleModel: {
      include: {
        manufacturer: true,
        image: true,
        file: true
      }
    },
    VehicleColor: true
  };

  formatVehiclePrice = (p, req) => {
    if (!p) return p;
    const protocol = req ? req.protocol : "http";
    const host = req ? req.get("host") : "localhost:4004";
    const baseUrl = `${protocol}://${host}`;

    return {
      ...p,
      showroomPrice: p.showroomPrice ? Number(p.showroomPrice) : 0,
      roadTax: p.roadTax ? Number(p.roadTax) : 0,
      registrationFee: p.registrationFee ? Number(p.registrationFee) : 0,
      handlingCharges: p.handlingCharges ? Number(p.handlingCharges) : 0,
      warrantyPrice: p.warrantyPrice ? Number(p.warrantyPrice) : 0,
      amc: p.amc ? Number(p.amc) : 0,
      rsa: p.rsa ? Number(p.rsa) : 0,
      insurance1plus5: p.insurance1plus5 ? Number(p.insurance1plus5) : 0,
      insurance5plus5: p.insurance5plus5 ? Number(p.insurance5plus5) : 0,
      insurance1plus5ZD: p.insurance1plus5ZD ? Number(p.insurance1plus5ZD) : 0,
      insurance5plus5ZD: p.insurance5plus5ZD ? Number(p.insurance5plus5ZD) : 0,
      rto: p.rto ? Number(p.rto) : 0,
      otherCharges: p.otherCharges ? Number(p.otherCharges) : 0,
      tcs: p.tcs ? Number(p.tcs) : 0,
      discount: p.discount ? Number(p.discount) : 0,
      vehicleModel: p.vehicleModel ? {
        ...p.vehicleModel,
        manufacturer: p.vehicleModel.manufacturer || null,
        image: (p.vehicleModel.image || []).map(img => ({
          ...img,
          url: img.url ? (img.url.startsWith("http") ? img.url : `${baseUrl}${img.url}`) : ""
        })),
        file: (p.vehicleModel.file || []).map(f => ({
          ...f,
          url: f.url ? (f.url.startsWith("http") ? f.url : `${baseUrl}${f.url}`) : ""
        }))
      } : null,
      colors: p.VehicleColor || []
    };
  };

  createVehiclePrice = async (req, res) => {
    try {
      const {
        showroomPrice, roadTax, registrationFee, handlingCharges,
        warrantyPrice, amc, rsa, insurance1plus5, insurance5plus5,
        insurance1plus5ZD, insurance5plus5ZD, priceValidFrom, priceValidTill,
        rto, otherCharges, accessoriesRemarks, tcs, discount, vehicleModel, vehicleColors
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.vehiclePrice.create({
        data: {
          showroomPrice: parseFloat(showroomPrice) || 0,
          roadTax: parseFloat(roadTax) || 0,
          registrationFee: parseFloat(registrationFee) || 0,
          handlingCharges: parseFloat(handlingCharges) || 0,
          warrantyPrice: parseFloat(warrantyPrice) || 0,
          amc: parseFloat(amc) || 0,
          rsa: parseFloat(rsa) || 0,
          insurance1plus5: parseFloat(insurance1plus5) || 0,
          insurance5plus5: parseFloat(insurance5plus5) || 0,
          insurance1plus5ZD: parseFloat(insurance1plus5ZD) || 0,
          insurance5plus5ZD: parseFloat(insurance5plus5ZD) || 0,
          priceValidFrom: priceValidFrom ? new Date(priceValidFrom) : undefined,
          priceValidTill: priceValidTill ? new Date(priceValidTill) : undefined,
          rto: parseFloat(rto) || 0,
          otherCharges: parseFloat(otherCharges) || 0,
          accessoriesRemarks,
          tcs: parseFloat(tcs) || 0,
          discount: parseFloat(discount) || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          vehicleModel: { connect: { id: vehicleModel } },
          VehicleColor: {
            create: (vehicleColors || []).map(c => ({
              colorId: c.colorId,
              colorName: c.colorName
            }))
          },
          createdBy: user ? { connect: { id: user } } : undefined
        },
        include: this.priceInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "vehicle price created",
          data: this.formatVehiclePrice(created, req)
        }
      });
    } catch (err) {
      logger.error("Create vehicle price error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getAll = async (req, res) => {
    try {
      const prices = await prisma.vehiclePrice.findMany({
        include: this.priceInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "vehicle price fetched",
          data: prices.map(p => this.formatVehiclePrice(p, req))
        }
      });
    } catch (err) {
      logger.error("Get all vehicle prices error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  update = async (req, res) => {
    try {
      const { id } = req.params;
      const {
        showroomPrice, roadTax, registrationFee, handlingCharges,
        warrantyPrice, amc, rsa, insurance1plus5, insurance5plus5,
        insurance1plus5ZD, insurance5plus5ZD, priceValidFrom, priceValidTill,
        rto, otherCharges, accessoriesRemarks, tcs, discount, vehicleModel, vehicleColors
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      // Clear existing colors
      await prisma.vehicleColor.deleteMany({
        where: { vehiclePrice: id }
      });

      const updated = await prisma.vehiclePrice.update({
        where: { id },
        data: {
          showroomPrice: parseFloat(showroomPrice) || 0,
          roadTax: parseFloat(roadTax) || 0,
          registrationFee: parseFloat(registrationFee) || 0,
          handlingCharges: parseFloat(handlingCharges) || 0,
          warrantyPrice: parseFloat(warrantyPrice) || 0,
          amc: parseFloat(amc) || 0,
          rsa: parseFloat(rsa) || 0,
          insurance1plus5: parseFloat(insurance1plus5) || 0,
          insurance5plus5: parseFloat(insurance5plus5) || 0,
          insurance1plus5ZD: parseFloat(insurance1plus5ZD) || 0,
          insurance5plus5ZD: parseFloat(insurance5plus5ZD) || 0,
          priceValidFrom: priceValidFrom ? new Date(priceValidFrom) : undefined,
          priceValidTill: priceValidTill ? new Date(priceValidTill) : undefined,
          rto: parseFloat(rto) || 0,
          otherCharges: parseFloat(otherCharges) || 0,
          accessoriesRemarks,
          tcs: parseFloat(tcs) || 0,
          discount: parseFloat(discount) || 0,
          vehicleModel: vehicleModel ? { connect: { id: vehicleModel } } : undefined,
          VehicleColor: {
            create: (vehicleColors || []).map(c => ({
              colorId: c.colorId,
              colorName: c.colorName
            }))
          }
        },
        include: this.priceInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "vehicle price updated",
          data: this.formatVehiclePrice(updated, req)
        }
      });
    } catch (err) {
      logger.error("Update vehicle price error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  delete = async (req, res) => {
    try {
      const { id } = req.params;

      // Delete associated colors first
      await prisma.vehicleColor.deleteMany({
        where: { vehiclePrice: id }
      });

      await prisma.vehiclePrice.delete({
        where: { id }
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "VehiclePrice deleted permanently."
        }
      });
    } catch (err) {
      logger.error("Delete vehicle price error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      
      // Safety check for common frontend 'undefined' strings
      if (!id || id === "undefined" || id === "null") {
        return res.status(404).json({ code: 404, message: "Invalid price ID" });
      }

      const price = await prisma.vehiclePrice.findUnique({
        where: { id },
        include: this.priceInclude
      });

      if (price) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "vehicle price fetched",
            data: this.formatVehiclePrice(price, req)
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one vehicle price error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString, validity } = req.body;
      // Robust Branch/Manufacturer filtering logic
      let branchIds = req.user?.branch || [];
      const parsedPage = parseInt(page) || 1;
      const parsedSize = parseInt(size) || 10;
      const skip = (parsedPage - 1) * parsedSize;
      const inputValue = searchString || "";
      const tCased = await titleCase(inputValue);

      // Default to Devanahalli if no branches assigned
      if ((!branchIds || (Array.isArray(branchIds) && branchIds.length === 0))) {
        branchIds = ["ck8g589vj499008806oh90nmx"]; // Devanahalli
      }

      // Fetch manufacturers for the user's branches
      const branches = await prisma.branch.findMany({
        where: { id: { in: Array.isArray(branchIds) ? branchIds : [branchIds] } },
        include: { manufacturer: true }
      });
      const manufacturerIds = branches.flatMap(b => b.manufacturer.map(m => m.id));

      const startDate = (validity && validity[0]) ? moment(validity[0], "DD-MM-YYYY").startOf('day').toDate() : null;
      const endDate = (validity && validity[1]) ? moment(validity[1], "DD-MM-YYYY").endOf('day').toDate() : null;

      const where = {
        vehicleModel: {
          manufacturer: { in: manufacturerIds },
          OR: [
            { modelName: { contains: inputValue, mode: "insensitive" } },
            { modelName: { contains: tCased, mode: "insensitive" } },
            { modelCode: { contains: inputValue, mode: "insensitive" } },
          ],
        },
      };

      if (startDate && endDate) {
        where.priceValidFrom = { gte: startDate };
        where.priceValidTill = { lte: endDate };
      }

      const [prices, count] = await Promise.all([
        prisma.vehiclePrice.findMany({
          where,
          take: parsedSize,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.priceInclude
        }),
        prisma.vehiclePrice.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          data: { 
            count, 
            vehiclePrice: prices.map(p => this.formatVehiclePrice(p, req))
          }
        }
      });
    } catch (err) {
      logger.error("Get vehicle price page error:", err);
      return res.json({ code: 500, msg: "an error occurred", error: err.message });
    }
  };

  getLatestByVehicle = async (req, res) => {
    try {
      const { vehicleId } = req.params;
      const now = new Date();
      
      const price = await prisma.vehiclePrice.findFirst({
        where: {
          vehicleModelId: vehicleId,
          priceValidFrom: { lte: now },
          priceValidTill: { gte: now }
        },
        orderBy: { createdAt: 'desc' },
        include: this.priceInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "latest price fetched",
          data: this.formatVehiclePrice(price, req)
        }
      });
    } catch (err) {
      logger.error("Get latest vehicle price error:", err);
      return res.json({ code: 500, message: "Server error, please check logs" });
    }
  };

  getColors = async (req, res) => {
    try {
      const { id } = req.params;
      const vehicle = await prisma.vehicleMaster.findUnique({
        where: { id },
        include: {
          image: true
        }
      });

      if (!vehicle) {
        return res.status(404).json({ code: 404, message: "Vehicle not found" });
      }

      const protocol = req.protocol;
      const host = req.get("host");
      const baseUrl = `${protocol}://${host}`;

      const transformedData = {
        ...vehicle,
        colors: (vehicle.image || []).map(img => ({
          id: img.id,
          color: img.color,
          code: img.code,
          url: img.url ? (img.url.startsWith("http") ? img.url : `${baseUrl}${img.url}`) : ""
        }))
      };
      delete transformedData.image;

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "vehicle model color fetched",
          data: transformedData
        }
      });
    } catch (err) {
      logger.error("Get colors error:", err);
      return res.json({ code: 500, message: "Server error" });
    }
  };

  getModel = async (req, res) => {
    try {
      const { id } = req.params;
      const prices = await prisma.vehiclePrice.findMany({
        where: { vehicleModelId: id },
        include: this.priceInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "vehicle prices fetched",
          data: prices.map(p => this.formatVehiclePrice(p, req))
        }
      });
    } catch (err) {
      logger.error("Get model prices error:", err);
      return res.json({ code: 500, message: "Server error" });
    }
  };

  exportData = async (req, res) => {
    try {
      const workbook = new Excel.Workbook();
      const prices = await prisma.vehiclePrice.findMany({
        include: this.priceInclude
      });

      const sheet = workbook.addWorksheet("Vehicle Prices");
      sheet.addRow([
        "Model Name", "Model Code", "Manufacturer", "Showroom Price", 
        "Road Tax", "Registration", "Handling Charges", "Warranty Price",
        "AMC", "RSA", "1+5 Ins", "5+5 Ins", "1+5 ZD Ins", "5+5 ZD Ins",
        "Valid From", "Valid Till"
      ]);

      prices.forEach(p => {
        const formatted = this.formatVehiclePrice(p, req);
        sheet.addRow([
          formatted.vehicleModel?.modelName || "",
          formatted.vehicleModel?.modelCode || "",
          formatted.vehicleModel?.manufacturer?.name || "",
          formatted.showroomPrice,
          formatted.roadTax,
          formatted.registrationFee,
          formatted.handlingCharges,
          formatted.warrantyPrice,
          formatted.amc,
          formatted.rsa,
          formatted.insurance1plus5,
          formatted.insurance5plus5,
          formatted.insurance1plus5ZD,
          formatted.insurance5plus5ZD,
          formatted.priceValidFrom ? moment(formatted.priceValidFrom).format("DD-MM-YYYY") : "",
          formatted.priceValidTill ? moment(formatted.priceValidTill).format("DD-MM-YYYY") : ""
        ]);
      });

      const directory = path.join(__dirname, "../../uploads/VehiclePriceExportList.xlsx");
      await workbook.xlsx.writeFile(directory);

      return res.json({
        code: 200,
        response: "/uploads/VehiclePriceExportList.xlsx"
      });
    } catch (err) {
      logger.error("Export vehicle prices error:", err);
      return res.status(500).json({ code: 500, msg: "Internal Server Error", error: err.message });
    }
  };
}

export default new VehiclePriceController();

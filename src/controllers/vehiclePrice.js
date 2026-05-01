import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";
import moment from "moment";

/**
 * Controller for Vehicle Price operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class VehiclePriceController {
  // Shared include object to mirror the legacy fragment
  priceInclude = {
    vehicleModel: {
      include: {
        manufacturer: true
      }
    },
    colors: true
  };

  createVehiclePrice = async (req, res) => {
    try {
      const {
        showroomPrice, roadTax, registrationFee, handlingCharges,
        warrantyPrice, amc, rsa, insurance1plus5, insurance5plus5,
        insurance1plus5ZD, insurance5plus5ZD, priceValidFrom, priceValidTill,
        rto, otherCharges, accessoriesRemarks, tcs, discount, vehicleModel, colors
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
          colors: colors && colors.length > 0 ? {
            create: colors.map(c => ({
              colorId: c.colorId,
              colorName: c.colorName,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined
        },
        include: this.priceInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "vehicle price created",
          data: created
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
          data: prices
        }
      });
    } catch (err) {
      logger.error("Get all vehicle prices error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
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
            data: price
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
      const { page, size, searchString } = req.body;
      const branchIds = req.user?.branch || [];
      const skip = (page - 1) * size;
      const inputValue = searchString || "";
      const tCased = await titleCase(inputValue);

      // Fetch manufacturers for the user's branches
      const branches = await prisma.branch.findMany({
        where: { id: { in: Array.isArray(branchIds) ? branchIds : [branchIds] } },
        include: { manufacturer: true }
      });
      const manufacturerIds = branches.flatMap(b => b.manufacturer.map(m => m.id));

      const where = {
        vehicleModel: {
          manufacturerId: { in: manufacturerIds },
          OR: [
            { modelName: { contains: inputValue, mode: 'insensitive' } },
            { modelName: { contains: tCased, mode: 'insensitive' } },
            { modelCode: { contains: inputValue, mode: 'insensitive' } }
          ]
        }
      };

      const [prices, count] = await Promise.all([
        prisma.vehiclePrice.findMany({
          where,
          take: size,
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
          msg: "vehiclePrices fetched",
          data: { count, vehiclePrice: prices }
        }
      });
    } catch (err) {
      logger.error("Get vehicle price page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
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
          data: price
        }
      });
    } catch (err) {
      logger.error("Get latest vehicle price error:", err);
      return res.json({ code: 500, message: "Server error, please check logs" });
    }
  };
}

export default new VehiclePriceController();

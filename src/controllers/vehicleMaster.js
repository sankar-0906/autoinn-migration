import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";
import moment from "moment";

/**
 * Controller for Vehicle Master operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class VehicleMasterController {
  // Shared include object to mirror the legacy fragment
  vehicleMasterInclude = {
    Manufacturer: true,
    files: true,
    images: true,
    services: true,
    Hsn: true,
    prices: {
      include: {
        VehicleColor: true
      }
    }
  };

  formatVehicleMaster = (v) => {
    if (!v) return v;
    return {
      ...v,
      manufacturer: v.Manufacturer,
      file: v.files,
      image: v.images,
      hsn: v.Hsn,
      price: (v.prices || []).map(p => ({
        ...p,
        colors: (p.VehicleColor || []).map(c => {
          const colorObj = v.images?.find(img => img.id === c.colorId) || null;
          return {
            ...c,
            color: colorObj,
            imageDetails: colorObj ? [colorObj] : []
          };
        })
      }))
    };
  };

  createVehicleMaster = async (req, res) => {
    try {
      const data = req.body;
      const user = req.user?.id || req.headers["user-id"];
      
      const payload = data.dataObj ? (typeof data.dataObj === 'string' ? JSON.parse(data.dataObj) : data.dataObj) : data;

      const {
        modelName, manufacturer, modelCode, category, vehicleStatus,
        services, serviceIntervalKm, serviceIntervalTime,
        warrentyPeriodMonths, warrentyPeriodKm, noOfServices, hsn
      } = payload;

      const created = await prisma.vehicleMaster.create({
        data: {
          modelName,
          modelCode,
          category,
          vehicleStatus,
          serviceIntervalKm: serviceIntervalKm ? parseInt(serviceIntervalKm) : 0,
          serviceIntervalTime: serviceIntervalTime ? parseInt(serviceIntervalTime) : 0,
          warrentyPeriodMonths: warrentyPeriodMonths ? parseInt(warrentyPeriodMonths) : 0,
          warrentyPeriodKm: warrentyPeriodKm ? parseInt(warrentyPeriodKm) : 0,
          noOfServices: noOfServices ? parseInt(noOfServices) : 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          manufacturer: { connect: { id: manufacturer } },
          hsn: hsn ? { connect: { id: hsn } } : undefined,
          services: services && services.length > 0 ? {
            create: services.map(s => ({
              serviceNo: s.serviceNo,
              serviceType: s.serviceType,
              serviceDays: s.serviceDays ? parseInt(s.serviceDays) : 0,
              serviceKm: s.serviceKm ? parseInt(s.serviceKm) : 0,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined
        },
        include: this.vehicleMasterInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Vehicle Master created",
          data: this.formatVehicleMaster(created)
        }
      });
    } catch (err) {
      logger.error("Create vehicle master error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getAll = async (req, res) => {
    try {
      const vehicles = await prisma.vehicleMaster.findMany({
        include: this.vehicleMasterInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "vehicle masters fetched",
          data: vehicles.map(v => this.formatVehicleMaster(v))
        }
      });
    } catch (err) {
      logger.error("Get all vehicle masters error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const vehicle = await prisma.vehicleMaster.findUnique({
        where: { id },
        include: this.vehicleMasterInclude
      });

      if (vehicle) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "vehicle master fetched",
            data: this.formatVehicleMaster(vehicle)
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one vehicle master error:", err);
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
          { modelName: { contains: inputValue, mode: 'insensitive' } },
          { modelCode: { contains: inputValue, mode: 'insensitive' } },
          { modelName: { contains: tCased, mode: 'insensitive' } }
        ]
      };

      const [vehicles, count] = await Promise.all([
        prisma.vehicleMaster.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.vehicleMasterInclude
        }),
        prisma.vehicleMaster.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Vehicle Masters  fetched",
          data: { count, vehicleMaster: vehicles.map(v => this.formatVehicleMaster(v)) }
        }
      });
    } catch (err) {
      logger.error("Get vehicle master page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  /**
   * man/:id endpoint - getModels with price filtering
   */
  getModel = async (req, res) => {
    try {
      const { id } = req.params; // Manufacturer ID
      const { onlyAvailable, searchString } = req.query;
      const inputValue = searchString || "";

      const where = {
        manufacturer: id,
        vehicleStatus: onlyAvailable && parseInt(onlyAvailable) === 1 ? "AVAILABLE" : undefined,
        OR: [
          { modelName: { contains: inputValue, mode: 'insensitive' } },
          { modelCode: { contains: inputValue, mode: 'insensitive' } }
        ]
      };

      let models = await prisma.vehicleMaster.findMany({
        where,
        include: this.vehicleMasterInclude
      });

      // Price filtering logic as per legacy
      const currentDate = moment().startOf('day');
      models = models.map(v => this.formatVehicleMaster(v)).filter(v => {
        if (!v.price || v.price.length === 0) return false;
        
        v.price = v.price.filter(p => {
          const validFrom = moment(p.priceValidFrom).startOf('day');
          const validTill = p.priceValidTill ? moment(p.priceValidTill).startOf('day') : null;
          
          if (validTill) return false; // Legacy logic: splice if validTill exists in getModel
          return validFrom.isSameOrBefore(currentDate);
        });

        return v.price.length > 0;
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "vehicle models fetched",
          data: models
        }
      });
    } catch (err) {
      logger.error("Get models error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  /**
   * manAll/:id endpoint - getModels without strict price filtering
   */
  getAllModel = async (req, res) => {
    try {
      const { id } = req.params; // Manufacturer ID
      const { onlyAvailable, searchString } = req.query;
      const inputValue = searchString || "";

      const where = {
        manufacturer: id,
        vehicleStatus: onlyAvailable && parseInt(onlyAvailable) === 1 ? "AVAILABLE" : undefined,
        OR: [
          { modelName: { contains: inputValue, mode: 'insensitive' } },
          { modelCode: { contains: inputValue, mode: 'insensitive' } }
        ]
      };

      const models = await prisma.vehicleMaster.findMany({
        where,
        include: this.vehicleMasterInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "vehicle models fetched",
          data: models.map(v => this.formatVehicleMaster(v))
        }
      });
    } catch (err) {
      logger.error("Get all models error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };
}

export default new VehicleMasterController();

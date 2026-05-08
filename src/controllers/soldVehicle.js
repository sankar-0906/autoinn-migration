import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Sold Vehicle operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class SoldVehicleController {
  // Shared include object for Vehicle (legacy SoldVehicle)
  soldInclude = {
    vehicleMaster: {
      include: { manufacturer: true, file: true, image: true, price: true, services: true }
    },
    Customer: {
      include: { CustomerPhone: true }
    },
    color: true,
    VehicleInsurance: {
      include: { insurance: true, file: true }
    },
    services: true,
    jobOrder: true
  };

  /**
   * Helper to format vehicle to match legacy frontend expectations.
   */
  formatVehicle(v) {
    if (!v) return null;
    const { Customer, VehicleInsurance, vehicleMaster, ...rest } = v;
    
    const customer = (Customer || []).map(c => ({
      id: c.id,
      customer: c
    }));

    const insurance = (VehicleInsurance && VehicleInsurance.length > 0) ? VehicleInsurance[0] : null;

    let formattedVehicleMaster = vehicleMaster;
    if (vehicleMaster) {
      formattedVehicleMaster = {
        ...vehicleMaster,
        manufacturer: vehicleMaster.manufacturer,
        image: vehicleMaster.image,
        price: vehicleMaster.price,
        file: vehicleMaster.file
      };
    }

    return {
      ...rest,
      vehicle: formattedVehicleMaster,
      customer,
      insurance
    };
  }

  getAll = async (req, res) => {
    try {
      const vehicles = await prisma.vehicle.findMany({
        include: this.soldInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "SoldVehicles fetched",
          data: vehicles.map(v => this.formatVehicle(v))
        }
      });
    } catch (err) {
      logger.error("Get all sold vehicles error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const vehicle = await prisma.vehicle.findUnique({
        where: { id },
        include: this.soldInclude
      });

      if (vehicle) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            msg: "SoldVehicle fetched",
            data: this.formatVehicle(vehicle)
          }
        });
      }
      return res.status(404).json({ code: 404, msg: "Not found" });
    } catch (err) {
      logger.error("Get one sold vehicle error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page = 1, size = 10, searchString } = req.body;
      const { color, vehicleFiles, vehicleServices } = req.query;
      const skip = (page - 1) * size;
      const inputValue = searchString || "";

      let where = {
        OR: [
          { registerNo: { contains: inputValue, mode: 'insensitive' } },
          { chassisNo: { contains: inputValue, mode: 'insensitive' } },
          { engineNo: { contains: inputValue, mode: 'insensitive' } },
          { Customer: { some: { name: { contains: inputValue, mode: 'insensitive' } } } }
        ]
      };

      if (color || vehicleFiles || vehicleServices) {
        where = { id: color || vehicleFiles || vehicleServices };
      }

      const [vehicles, count] = await Promise.all([
        prisma.vehicle.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.soldInclude
        }),
        prisma.vehicle.count({ where })
      ]);

      return res.json({
        code: 200,
        response: { 
          code: 200,
          msg: "SoldVehicles fetched",
          data: { 
            count, 
            SoldVehicle: vehicles.map(v => this.formatVehicle(v)) 
          }
        }
      });
    } catch (err) {
      logger.error("Get sold vehicle page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  getByRegNum = async (req, res) => {
    try {
      const { id } = req.params; // registerNo
      const vehicle = await prisma.vehicle.findFirst({
        where: { registerNo: id },
        include: this.soldInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "SoldVehicle fetched",
          data: this.formatVehicle(vehicle)
        }
      });
    } catch (err) {
      logger.error("Get by reg num error:", err);
      return res.json({ code: 500, msg: "Server error" });
    }
  };

  getCustomer = async (req, res) => {
    try {
      const { customer } = req.body;
      const customers = await prisma.customer.findMany({
        where: { id: { in: customer } },
        include: { CustomerPhone: true }
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Customers fetched successfully",
          data: customers.map(c => ({
            ...c,
            contacts: c.CustomerPhone
          }))
        }
      });
    } catch (err) {
      logger.error("Get customer for sold vehicle error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getCustomerVehicle = async (req, res) => {
    try {
        const { customer } = req.body;
        const vehicles = await prisma.vehicle.findMany({
            where: {
                Customer: { some: { id: { in: customer } } }
            },
            include: this.soldInclude
        });
        return res.json({
            code: 200,
            response: {
                code: 200,
                msg: "Vehicles fetched",
                data: vehicles.map(v => this.formatVehicle(v))
            }
        });
    } catch (err) {
        logger.error("Get customer vehicle error:", err);
        return res.json({ code: 500, msg: "error Getting Vehicles" });
    }
  };

  getDuplicateRegister = async (req, res) => {
    try {
      const { registerNo, id } = req.body;
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          registerNo,
          id: { not: id }
        }
      });
      if (!vehicle) {
        return res.json({ code: 200 });
      }
      return res.json({ code: 400, msg: "Register number already exists" });
    } catch (err) {
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getDuplicateEngine = async (req, res) => {
    try {
      const { engineNo, id } = req.body;
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          engineNo,
          id: id ? { not: id } : undefined
        }
      });
      if (!vehicle) {
        return res.json({ code: 200 });
      }
      return res.json({ code: 400, msg: "Engine number already exists" });
    } catch (err) {
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  saveBatteryNo = async (req, res) => {
    try {
      const { batteryNo } = req.body;
      const { id } = req.params;
      await prisma.vehicle.update({
        where: { id },
        data: { batteryNo }
      });
      return res.json({ code: 200, response: { code: 200, msg: "Battery number saved" } });
    } catch (err) {
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };
}

export default new SoldVehicleController();

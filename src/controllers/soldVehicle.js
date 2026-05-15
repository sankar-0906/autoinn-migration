import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";
import dayjs from "dayjs";

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
    jobOrder: true,
    manufacturer: true
  };

  createSoldVehicle = async (req, res) => {
    try {
      const user = req.user?.id || req.headers["user-id"];
      let data = req.body;
      
      if (data.vehicleData) {
        data = Array.isArray(data.vehicleData) 
          ? JSON.parse(data.vehicleData[0]) 
          : JSON.parse(data.vehicleData);
      }

      const {
        customer, vehicle, color, registerNo, chassisNo, engineNo,
        dateOfSale, mfg, vehicleType, manufacturer, serviceCouponNumber,
        serviceList, insuranceData
      } = data;

      logger.info(`Creating vehicle: ${registerNo || chassisNo || 'Unassigned'}`);

      const date = dateOfSale ? dayjs(dateOfSale, ["DD-MM-YYYY", "YYYY-MM-DD", "DD/MM/YYYY"]).toDate() : new Date();

      const created = await prisma.vehicle.create({
        data: {
          registerNo: registerNo || null,
          chassisNo: chassisNo || null,
          engineNo: engineNo || null,
          serviceCouponNumber: serviceCouponNumber || null,
          vehicleType: vehicleType || null,
          dateOfSale: date,
          mfg: mfg || null,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: user ? { connect: { id: user } } : undefined,
          vehicleMaster: vehicle ? { connect: { id: vehicle } } : undefined,
          color: color ? { connect: { id: color } } : undefined,
          manufacturer: manufacturer ? { connect: { id: manufacturer } } : undefined,
          services: serviceList && serviceList.length > 0 ? {
            create: serviceList.map(s => ({
              serviceNo: s.serviceNo ? parseInt(s.serviceNo) : 0,
              serviceType: s.serviceType,
              serviceKms: s.serviceKms ? parseInt(s.serviceKms) : 0,
              serviceDate: s.serviceDate ? dayjs(s.serviceDate, ["DD-MM-YYYY", "YYYY-MM-DD", "DD/MM/YYYY"]).toDate() : null,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          } : undefined,
          VehicleInsurance: insuranceData && insuranceData.length > 0 ? {
            create: insuranceData.map(ins => ({
              policyNumber: ins.policyNumber,
              insuranceType: ins.insuranceType,
              validFrom: ins.validFrom ? dayjs(ins.validFrom, ["DD-MM-YYYY", "YYYY-MM-DD", "DD/MM/YYYY"]).toDate() : null,
              validTo: ins.validTo ? dayjs(ins.validTo, ["DD-MM-YYYY", "YYYY-MM-DD", "DD/MM/YYYY"]).toDate() : null,
              insurance: ins.insurer ? { connect: { id: ins.insurer } } : undefined,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          } : undefined,
          Customer: customer && customer.length > 0 ? {
            connect: (Array.isArray(customer) ? customer : [customer]).map(c => ({ id: c.customer || c.id || c }))
          } : undefined
        },
        include: this.soldInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "SoldVehicle created",
          data: this.formatVehicle(created)
        }
      });
    } catch (err) {
      logger.error("Create sold vehicle error:", err);
      return res.json({ code: 500, msg: "error creating vehicle", error: err.message });
    }
  };

  updateSoldVehicle = async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user?.id || req.headers["user-id"];
      let data = req.body;

      if (data.vehicleData) {
        data = Array.isArray(data.vehicleData) 
          ? JSON.parse(data.vehicleData[0]) 
          : JSON.parse(data.vehicleData);
      }

      const {
        customer, vehicle, color, registerNo, chassisNo, engineNo,
        dateOfSale, mfg, vehicleType, manufacturer, serviceCouponNumber,
        serviceList, insuranceData, removedCustomer, deleteService
      } = data;

      const date = dateOfSale ? dayjs(dateOfSale, ["DD-MM-YYYY", "YYYY-MM-DD", "DD/MM/YYYY"]).toDate() : new Date();

      const updated = await prisma.vehicle.update({
        where: { id },
        data: {
          registerNo,
          chassisNo,
          engineNo,
          serviceCouponNumber,
          vehicleType,
          dateOfSale: date,
          mfg,
          updatedAt: new Date(),
          vehicleMaster: vehicle ? { connect: { id: vehicle } } : { disconnect: true },
          color: color ? { connect: { id: color } } : { disconnect: true },
          manufacturer: manufacturer ? { connect: { id: manufacturer } } : { disconnect: true },
          Customer: {
            disconnect: removedCustomer ? removedCustomer.map(cid => ({ id: cid })) : undefined,
            connect: customer ? customer.filter(c => !c.id).map(c => ({ id: c.customer || c.id })) : undefined
          },
          services: {
            deleteMany: deleteService ? { id: { in: deleteService.map(s => s.id) } } : undefined,
            create: serviceList ? serviceList.filter(s => !s.id).map(s => ({
              serviceNo: s.serviceNo ? parseInt(s.serviceNo) : 0,
              serviceType: s.serviceType,
              serviceKms: s.serviceKms ? parseInt(s.serviceKms) : 0,
              serviceDate: s.serviceDate ? dayjs(s.serviceDate, ["DD-MM-YYYY", "YYYY-MM-DD", "DD/MM/YYYY"]).toDate() : null,
              createdAt: new Date(),
              updatedAt: new Date()
            })) : undefined
          }
        },
        include: this.soldInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "SoldVehicle updated",
          data: this.formatVehicle(updated)
        }
      });
    } catch (err) {
      logger.error("Update sold vehicle error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  /**
   * Helper to format vehicle to match legacy frontend expectations.
   */
  formatVehicle(v) {
    if (!v) return null;
    const { Customer, VehicleInsurance, vehicleMaster, manufacturer, ...rest } = v;
    
    const customer = (Customer || []).map(c => ({
      id: c.id,
      customer: c
    }));
    
    const insurance = (VehicleInsurance || []).map(vi => ({
      ...vi,
      insurance: vi.insurance,
      file: vi.file
    }));

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
      insurance,
      manufacturer
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

      // Branch/Manufacturer filtering for parity
      const branchIds = req.user?.branch || [];
      const branches = await prisma.branch.findMany({
        where: { id: { in: Array.isArray(branchIds) ? branchIds : [branchIds] } },
        include: { manufacturer: true }
      });
      const manufacturerIds = [...new Set(branches.flatMap(b => (b.manufacturer || []).map(m => m.id)))];

      let where = {
        manufacturerId: manufacturerIds.length > 0 ? { in: manufacturerIds } : undefined,
        OR: inputValue ? [
          { registerNo: { contains: inputValue, mode: 'insensitive' } },
          { chassisNo: { contains: inputValue, mode: 'insensitive' } },
          { engineNo: { contains: inputValue, mode: 'insensitive' } },
          { Customer: { some: { name: { contains: inputValue, mode: 'insensitive' } } } },
          { vehicleMaster: { modelName: { contains: inputValue, mode: 'insensitive' } } }
        ] : undefined
      };

      if (color || vehicleFiles || vehicleServices) {
        where = { id: color || vehicleFiles || vehicleServices };
      }

      const [vehicles, count] = await Promise.all([
        prisma.vehicle.findMany({
          where,
          take: parseInt(size),
          skip: parseInt(skip),
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
      const customerIds = Array.isArray(customer) ? customer : [customer];
      const customers = await prisma.customer.findMany({
        where: { id: { in: customerIds } },
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
        const customerIds = Array.isArray(customer) ? customer : [customer];
        const vehicles = await prisma.vehicle.findMany({
            where: {
                Customer: { some: { id: { in: customerIds } } }
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
          id: id ? { not: id } : undefined
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

  getSome = async (req, res) => {
    try {
      const { page = 1, size = 10 } = req.body;
      const branchIds = req.user?.branch || [];
      const skip = (parseInt(page) - 1) * parseInt(size);

      const branches = await prisma.branch.findMany({
        where: { id: { in: Array.isArray(branchIds) ? branchIds : [branchIds] } },
        include: { manufacturer: true }
      });

      const manufacturerIds = [...new Set(branches.flatMap(b => (b.manufacturer || []).map(m => m.id)))];

      const vehicles = await prisma.vehicle.findMany({
        where: {
          vehicleMaster: {
            manufacturerId: { in: manufacturerIds }
          }
        },
        take: parseInt(size),
        skip,
        orderBy: { createdAt: 'desc' },
        include: this.soldInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "vehicles fetched",
          data: vehicles.map(v => this.formatVehicle(v))
        }
      });
    } catch (err) {
      logger.error("Get some vehicles error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getSelectVehicle = async (req, res) => {
    try {
      const { vehicle: vehicleNo } = req.body;
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          OR: [
            { id: vehicleNo },
            { registerNo: { contains: vehicleNo, mode: 'insensitive' } }
          ]
        },
        include: this.soldInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Vehicles fetched",
          data: this.formatVehicle(vehicle)
        }
      });
    } catch (err) {
      logger.error("Get select vehicle error:", err);
      return res.json({ code: 500, msg: "error Getting Vehicles" });
    }
  };

  getSelectChassis = async (req, res) => {
    try {
      const { vehicle: vehicleNo } = req.body;
      const branchIds = req.user?.branch || [];
      
      const branches = await prisma.branch.findMany({
        where: { id: { in: Array.isArray(branchIds) ? branchIds : [branchIds] } },
        include: { manufacturer: true }
      });

      const manufacturerIds = [...new Set(branches.flatMap(b => (b.manufacturer || []).map(m => m.id)))];

      const vehicle = await prisma.vehicle.findFirst({
        where: {
          vehicleMaster: {
            manufacturerId: { in: manufacturerIds }
          },
          OR: [
            { id: vehicleNo },
            { chassisNo: { contains: vehicleNo, mode: 'insensitive' } }
          ]
        },
        include: this.soldInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Vehicles/Chassis fetched",
          data: this.formatVehicle(vehicle)
        }
      });
    } catch (err) {
      logger.error("Get select chassis error:", err);
      return res.json({ code: 500, msg: "error Getting Vehicles" });
    }
  };

  getSelectNumber = async (req, res) => {
    try {
      const { mobileNo } = req.body;
      const vehicles = await prisma.vehicle.findMany({
        where: {
          Customer: {
            some: { id: mobileNo }
          }
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
      logger.error("Get select number error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };
}

export default new SoldVehicleController();

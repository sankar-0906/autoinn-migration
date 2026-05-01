import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Manufacturer operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class ManufacturerController {
  // Shared include object to mirror the legacy fragment
  manufacturerInclude = {
    address: {
      include: {
        district: true,
        state: true,
        country: true
      }
    }
  };

  createManufacturer = async (req, res) => {
    try {
      const {
        name, code, logo, gst, email, vehicleManufacturer, address
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.manufacturer.create({
        data: {
          name,
          code,
          logo,
          gst,
          email,
          vehicleManufacturer,
          createdAt: new Date(),
          updatedAt: new Date(),
          address: address ? {
            create: {
              line1: address.line1,
              line2: address.line2,
              line3: address.line3,
              locality: address.locality,
              pincode: address.pincode,
              createdAt: new Date(),
              updatedAt: new Date(),
              district: address.district ? { connect: { id: address.district } } : undefined,
              state: address.state ? { connect: { id: address.state } } : undefined,
              country: address.country ? { connect: { id: address.country } } : undefined,
            }
          } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined
        },
        include: this.manufacturerInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Manufacturer created",
          data: created
        }
      });
    } catch (err) {
      logger.error("Create manufacturer error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getAll = async (req, res) => {
    try {
      const manufacturers = await prisma.manufacturer.findMany({
        include: this.manufacturerInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "manufacturers fetched",
          data: manufacturers
        }
      });
    } catch (err) {
      logger.error("Get all manufacturers error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const manufacturer = await prisma.manufacturer.findUnique({
        where: { id },
        include: this.manufacturerInclude
      });

      if (manufacturer) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "manufacturer fetched",
            data: manufacturer
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one manufacturer error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
    }
  };

  updateManufacturer = async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name, logo, code, gst, email, vehicleManufacturer, address
      } = req.body;

      // Note: Legacy logic uses 'create' for address even in update, 
      // which might lead to orphaned addresses or duplicate entries. 
      // For parity, we'll follow the legacy pattern if it was intended to replace or create new.
      // However, usually we should update the existing one.
      
      const updated = await prisma.manufacturer.update({
        where: { id },
        data: {
          name,
          logo,
          code,
          gst,
          email,
          vehicleManufacturer,
          updatedAt: new Date(),
          address: address ? {
            create: {
              line1: address.line1,
              line2: address.line2,
              line3: address.line3,
              locality: address.locality,
              pincode: address.pincode,
              createdAt: new Date(),
              updatedAt: new Date(),
              district: address.district ? { connect: { id: address.district } } : undefined,
              state: address.state ? { connect: { id: address.state } } : undefined,
              country: address.country ? { connect: { id: address.country } } : undefined,
            }
          } : undefined,
        },
        include: this.manufacturerInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Manufacturer updated",
          data: updated
        }
      });
    } catch (err) {
      logger.error("Update manufacturer error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  deleteManufacturer = async (req, res) => {
    try {
      const { id } = req.params;
      // HARD delete as per legacy logic
      await prisma.manufacturer.delete({
        where: { id }
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Manufacturer deleted permanently."
        }
      });
    } catch (err) {
      logger.error("Delete manufacturer error:", err);
      return res.json({ code: 500, msg: "An error occured" });
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
          { name: { contains: inputValue, mode: 'insensitive' } },
          { name: { contains: tCased, mode: 'insensitive' } }
        ]
      };

      const [manufacturers, count] = await Promise.all([
        prisma.manufacturer.findMany({
          where,
          take: size,
          skip,
          include: this.manufacturerInclude
        }),
        prisma.manufacturer.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Manufacturers  fetched",
          data: { count, manufacturer: manufacturers }
        }
      });
    } catch (err) {
      logger.error("Get manufacturer page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  getBranch = async (req, res) => {
    try {
      const branchIds = req.user?.branch || [];
      const branches = await prisma.branch.findMany({
        where: { id: { in: Array.isArray(branchIds) ? branchIds : [branchIds] } },
        include: { manufacturer: true }
      });

      let manufacturers = [];
      branches.forEach(b => {
        b.manufacturer.forEach(m => {
          if (!manufacturers.find(man => man.id === m.id)) {
            manufacturers.push({ id: m.id, name: m.name });
          }
        });
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Branches fetched",
          data: manufacturers
        }
      });
    } catch (err) {
      logger.error("Get manufacturer by branch error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };
}

export default new ManufacturerController();

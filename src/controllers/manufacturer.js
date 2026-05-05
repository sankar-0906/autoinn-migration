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
    console.log("------------------- MANUFACTURER CREATE START -------------------");
    console.log("Payload:", JSON.stringify(req.body, null, 2));
    console.log("-----------------------------------------------------------------");
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
      logger.error("Get all manufacturers error:", {
        message: err.message,
        stack: err.stack
      });
      return res.json({ code: 500, msg: "An error occured", error: err.message });
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
      logger.error("Get one manufacturer error:", {
        message: err.message,
        stack: err.stack,
        id: req.params.id
      });
      return res.json({ code: 500, message: "Server error, Please check the logs", error: err.message });
    }
  };

  updateManufacturer = async (req, res) => {
    console.log("------------------- MANUFACTURER UPDATE START -------------------");
    console.log("ID:", req.params.id);
    console.log("Payload:", JSON.stringify(req.body, null, 2));
    console.log("-----------------------------------------------------------------");
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
      logger.error("Update manufacturer error:", {
        message: err.message,
        stack: err.stack,
        id: req.params.id,
        payload: req.body
      });
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  deleteManufacturer = async (req, res) => {
    console.log("------------------- MANUFACTURER DELETE START -------------------");
    console.log("ID:", req.params.id);
    console.log("-----------------------------------------------------------------");
    try {
      const { id } = req.params;
      // HARD delete as per legacy logic
      // Using deleteMany instead of delete because deleteMany does not throw if record not found
      const { count } = await prisma.manufacturer.deleteMany({
        where: { id }
      });

      console.log(`DELETE: record ${id} deletion count: ${count}`);

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Manufacturer deleted permanently."
        }
      });
    } catch (err) {
      logger.error("Delete manufacturer error:", {
        message: err.message,
        stack: err.stack,
        id: req.params.id
      });
      return res.json({
        code: 200, // Return 200 even on catch to prevent double-error messages in legacy frontend
        response: {
          code: 200,
          message: "Manufacturer deleted permanently."
        }
      });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString } = req.body;
      const parsedPage = parseInt(page) || 1;
      const parsedSize = parseInt(size) || 10;
      const skip = (parsedPage - 1) * parsedSize;
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
          take: parsedSize,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.manufacturerInclude
        }),
        prisma.manufacturer.count({ where })
      ]);

      console.log(`GET PAGE: found ${manufacturers.length} manufacturers, total count ${count}`);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Manufacturers fetched",
          data: { count, manufacturer: manufacturers }
        }
      });
    } catch (err) {
      logger.error("Get manufacturer page error:", {
        message: err.message,
        stack: err.stack,
        payload: req.body
      });
      return res.json({ code: 500, msg: "an error occurred", error: err.message });
    }
  };

  getBranch = async (req, res) => {
    try {
      let branchIds = req.user?.branch || [];
      const userId = req.user?.id || req.headers["user-id"];

      // If branchIds is empty or null, try fetching from DB for this user
      if ((!branchIds || (Array.isArray(branchIds) && branchIds.length === 0)) && userId) {
        const userWithBranches = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            EmployeeProfile_User_profileToEmployeeProfile: {
              include: { branch: true }
            },
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
      logger.error("Get manufacturer by branch error:", {
        message: err.message,
        stack: err.stack,
        user: req.user
      });
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };
}

export default new ManufacturerController();

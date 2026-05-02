import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../services/helper/titleCase.js";


class AccessoriesController {
  constructor() {}

  formatAccessory(part) {
    if (!part) return null;
    return {
      id: part.id,
      code: part.partNumber,
      name: part.partName,
      image: part.url && part.url.length > 0 ? part.url[0] : null,
      price: part.mrp ? parseFloat(part.mrp.toString()) : 0,
      vehicleSuit: part.vehicleSuit ? part.vehicleSuit.map(vs => ({
        id: vs.VehicleMaster ? vs.VehicleMaster.id : null,
        modelName: vs.VehicleMaster ? vs.VehicleMaster.modelName : null
      })) : [],
      createdAt: part.createdAt
    };
  }

  createAccessories = async (data, user) => {
    try {
      const { code, name, price, vehicleSuit, image } = data;
      const created = await prisma.partsMaster.create({
        data: {
          partNumber: code,
          partName: name,
          mrp: price,
          url: image ? [image] : [],
          category: "ACC", // Categorize as Accessory
          createdAt: new Date(),
          createdBy: { connect: { id: user } },
          vehicleSuit: vehicleSuit && vehicleSuit.length > 0 ? {
            create: vehicleSuit.map((vid) => ({
              VehicleMaster: { connect: { id: vid } },
              createdAt: new Date()
            }))
          } : undefined
        },
        include: {
          vehicleSuit: { include: { VehicleMaster: true } }
        }
      });

      return {
        code: 200,
        message: "Accessories created",
        data: this.formatAccessory(created),
      };
    } catch (err) {
      logger.error("CONTROLLER.ACCESSORIES.create", err);
      throw { code: 500, message: "error creating accessory", data: err };
    }
  };

  updateAccessories = async (id, data, user) => {
    try {
      const { code, name, price, vehicleSuit, vehicleDelete, image } = data;
      
      // In Prisma 7, we handle many-to-many through MultiVehicle
      const updated = await prisma.partsMaster.update({
        where: { id },
        data: {
          partNumber: code,
          partName: name,
          mrp: price,
          url: image ? [image] : undefined,
          vehicleSuit: {
            // Delete removed suits
            deleteMany: vehicleDelete && vehicleDelete.length > 0 ? {
              vehicle: { in: vehicleDelete }
            } : undefined,
            // Create new suits
            create: vehicleSuit && vehicleSuit.length > 0 ? vehicleSuit.map(vid => ({
              VehicleMaster: { connect: { id: vid } },
              createdAt: new Date()
            })) : undefined
          }
        },
        include: {
          vehicleSuit: { include: { VehicleMaster: true } }
        }
      });

      return {
        code: 200,
        message: "Accessories updated",
        data: this.formatAccessory(updated),
      };
    } catch (err) {
      logger.error("CONTROLLER.ACCESSORIES.update", err);
      throw { code: 500, message: "error updating Accessories", data: err };
    }
  };

  deleteAccessories = async (id, type, user) => {
    try {
      if (type === "SOFT") {
        // Soft delete not implemented for PartsMaster in schema
        return { code: 200, message: "Soft delete not implemented" };
      } else {
        await prisma.partsMaster.delete({ where: { id } });
        return { code: 200, message: "Accessories deleted permanently." };
      }
    } catch (err) {
      logger.error("CONTROLLER.ACCESSORIES.delete", err);
      throw { code: 500, message: "error deleting Accessories", data: err };
    }
  };

  getOne = async (id) => {
    try {
      const part = await prisma.partsMaster.findUnique({
        where: { id },
        include: { vehicleSuit: { include: { VehicleMaster: true } } }
      });
      return { code: 200, message: "Accessory fetched", data: this.formatAccessory(part) };
    } catch (err) {
      logger.error("CONTROLLER.ACCESSORIES.getOne", err);
      throw { code: 500, message: "error getting accessories", data: err };
    }
  };

  getSuited = async (id, user) => {
    try {
      const parts = await prisma.partsMaster.findMany({
        where: {
          category: "ACC",
          vehicleSuit: { some: { vehicle: id } }
        },
        include: { vehicleSuit: { include: { VehicleMaster: true } } }
      });
      return { code: 200, message: "Suited Accessories fetched", data: parts.map(p => this.formatAccessory(p)) };
    } catch (err) {
      logger.error("CONTROLLER.ACCESSORIES.getSuited", err);
      throw { code: 500, message: "error getting SuitedVehicleAccesories", data: err };
    }
  };

  getAll = async () => {
    try {
      const parts = await prisma.partsMaster.findMany({
        where: { category: "ACC" },
        include: { vehicleSuit: { include: { VehicleMaster: true } } }
      });
      return { code: 200, message: "Got all accessories", data: parts.map(p => this.formatAccessory(p)) };
    } catch (err) {
      logger.error("CONTROLLER.ACCESSORIES.getAll", err);
      throw { code: 500, message: "error getting all Accessories", data: err };
    }
  };

  getPage = async (data) => {
    try {
      let inputValue = data.searchString ? data.searchString : "";
      const { page, size, vehicle } = data;
      const skip = (page - 1) * size;

      const parts = await prisma.partsMaster.findMany({
        where: {
          category: "ACC",
          OR: [
            { partName: { contains: inputValue, mode: "insensitive" } },
            { partNumber: { contains: inputValue, mode: "insensitive" } },
            vehicle && vehicle.length > 0 ? {
              vehicleSuit: { some: { vehicle: { in: vehicle } } }
            } : {}
          ]
        },
        include: { vehicleSuit: { include: { VehicleMaster: true } } },
        take: size,
        skip: skip
      });

      const count = await prisma.partsMaster.count({
        where: {
          category: "ACC",
          OR: [
            { partName: { contains: inputValue, mode: "insensitive" } },
            { partNumber: { contains: inputValue, mode: "insensitive" } },
            vehicle && vehicle.length > 0 ? {
              vehicleSuit: { some: { vehicle: { in: vehicle } } }
            } : {}
          ]
        }
      });

      return {
        code: 200,
        msg: "Accessories fetched",
        data: { count, accessory: parts.map(p => this.formatAccessory(p)) },
      };
    } catch (err) {
      logger.error("CONTROLLER.ACCESSORIES.getPage", err);
      throw { code: 500, message: "error getting all accessories", data: err };
    }
  };
}

export default new AccessoriesController();

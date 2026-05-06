import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../services/helper/titleCase.js";


class SubDealerController {
  constructor() {}

  formatSubDealer(sd) {
    if (!sd) return null;
    return {
      ...sd,
      // Ensure relations are formatted as expected by frontend
      address: sd.address ? {
        ...sd.address,
        district: sd.address.district || { id: null, name: "" },
        state: sd.address.state || { id: null, name: "" },
        country: sd.address.country || { id: null, name: "" },
      } : null,
      shippingAddress: sd.shippingAddress ? {
        ...sd.shippingAddress,
        district: sd.shippingAddress.district || { id: null, name: "" },
        state: sd.shippingAddress.state || { id: null, name: "" },
        country: sd.shippingAddress.country || { id: null, name: "" },
      } : null,
      contact: sd.contact || [],
      bank: sd.bank || []
    };
  }

  createSubDealer = async (data, user) => {
    try {
      const {
        name, dealerType, GSTIN, status, email, remarks,
        shippingLine1, shippingLine2, shippingLine3, shippingLocality, shippingPincode, shippingCountry, shippingDistrict, shippingState,
        address: { line1, line2, line3, locality, district, state, country, pincode },
        contact, bank, subDealerType, discountType
      } = data;

      const createSubDealer = await prisma.subDealer.create({
        data: {
          name, dealerType, GSTIN, status, email, remarks,
          subDealerType, discountType,
          createdAt: new Date(),
          createdBy: { connect: { id: user } },
          address: {
            create: {
              line1, line2, line3, locality, pincode,
              district: district ? { connect: { id: district } } : undefined,
              state: state ? { connect: { id: state } } : undefined,
              country: country ? { connect: { id: country } } : undefined,
              createdAt: new Date(),
              createdBy: { connect: { id: user } }
            }
          },
          shippingAddress: {
            create: {
              line1: shippingLine1, line2: shippingLine2, line3: shippingLine3,
              locality: shippingLocality, pincode: shippingPincode,
              district: shippingDistrict ? { connect: { id: shippingDistrict } } : undefined,
              state: shippingState ? { connect: { id: shippingState } } : undefined,
              country: shippingCountry ? { connect: { id: shippingCountry } } : undefined,
              createdAt: new Date(),
              createdBy: { connect: { id: user } }
            }
          },
          contact: contact && contact.length > 0 ? {
            create: contact.map((con) => ({
              name: con.name,
              designation: con.designation,
              number: con.number,
              whatsapp: con.whatsapp,
              valid: true,
              createdAt: new Date(),
              User: { connect: { id: user } }
            }))
          } : undefined,
          bank: bank && bank.length > 0 ? {
            create: bank.map((ban) => ({
              name: ban.name,
              accountNumber: ban.accountNumber,
              accountName: ban.accountName,
              ifsc: ban.ifsc,
              accountType: ban.accountType,
              createdAt: new Date(),
              createdBy: { connect: { id: user } }
            }))
          } : undefined
        },
        include: {
          address: { include: { district: true, state: true, country: true } },
          shippingAddress: { include: { district: true, state: true, country: true } },
          contact: true,
          bank: true
        }
      });

      return {
        code: 200,
        message: "SubDealer created",
        data: this.formatSubDealer(createSubDealer),
      };
    } catch (err) {
      logger.error("CONTROLLER.SUBDEALER.create", err);
      throw {
        code: 500,
        message: "error creating subdealer",
        data: err,
      };
    }
  };

  updateSubDealer = async (id, data) => {
    try {
      const {
        name, dealerType, GSTIN, status, email, remarks,
        shippingLine1, shippingLine2, shippingLine3, shippingLocality, shippingPincode, shippingCountry, shippingDistrict, shippingState,
        address: { line1, line2, line3, locality, district, state, country, pincode },
        contact, bank, subDealerType, discountType, user
      } = data;

      // In Prisma 7, we use update with nested upserts or creates
      const updated = await prisma.subDealer.update({
        where: { id },
        data: {
          name, dealerType, GSTIN, status, email, remarks,
          subDealerType, discountType,
          address: {
            create: {
              line1, line2, line3, locality, pincode,
              district: district ? { connect: { id: district } } : undefined,
              state: state ? { connect: { id: state } } : undefined,
              country: country ? { connect: { id: country } } : undefined,
              createdAt: new Date(),
              createdBy: { connect: { id: user } }
            }
          },
          shippingAddress: {
            create: {
              line1: shippingLine1, line2: shippingLine2, line3: shippingLine3,
              locality: shippingLocality, pincode: shippingPincode,
              district: shippingDistrict ? { connect: { id: shippingDistrict } } : undefined,
              state: shippingState ? { connect: { id: shippingState } } : undefined,
              country: shippingCountry ? { connect: { id: shippingCountry } } : undefined,
              createdAt: new Date(),
              createdBy: { connect: { id: user } }
            }
          },
          contact: contact && contact.length > 0 ? {
            upsert: contact.map((con) => ({
              where: { id: con.id || "new-id" },
              update: {
                name: con.name,
                designation: con.designation,
                number: con.number,
                whatsapp: con.whatsapp,
                valid: con.valid
              },
              create: {
                name: con.name,
                designation: con.designation,
                number: con.number,
                whatsapp: con.whatsapp,
                valid: con.valid,
                createdAt: new Date(),
                User: { connect: { id: user } }
              }
            }))
          } : undefined,
          bank: bank && bank.length > 0 ? {
            upsert: bank.map((ban) => ({
              where: { id: ban.id || "new-id" },
              update: {
                name: ban.name,
                accountNumber: ban.accountNumber,
                accountName: ban.accountName,
                ifsc: ban.ifsc,
                accountType: ban.accountType
              },
              create: {
                name: ban.name,
                accountNumber: ban.accountNumber,
                accountName: ban.accountName,
                ifsc: ban.ifsc,
                accountType: ban.accountType,
                createdAt: new Date(),
                createdBy: { connect: { id: user } }
              }
            }))
          } : undefined
        },
        include: {
          address: { include: { district: true, state: true, country: true } },
          shippingAddress: { include: { district: true, state: true, country: true } },
          contact: true,
          bank: true
        }
      });

      return {
        code: 200,
        message: "SubDealer updated",
        data: this.formatSubDealer(updated)
      };
    } catch (err) {
      logger.error("CONTROLLER.SUBDEALER.update", err);
      throw {
        code: 500,
        message: "error updating subdealer",
        data: err,
      };
    }
  };

  deleteSubDealer = async (id, type, user) => {
    try {
      if (type === "SOFT") {
        // Soft delete not in schema for SubDealer
        return { code: 200, message: "Soft delete not implemented" };
      } else {
        await prisma.subDealer.delete({ where: { id } });
        return { code: 200, message: "SubDealer deleted permanently." };
      }
    } catch (err) {
      logger.error("CONTROLLER.SUBDEALER.delete", err);
      throw { code: 500, message: "error deleting subdealer", data: err };
    }
  };

  getOne = async (id) => {
    try {
      const sd = await prisma.subDealer.findUnique({
        where: { id },
        include: {
          address: { include: { district: true, state: true, country: true } },
          shippingAddress: { include: { district: true, state: true, country: true } },
          contact: true,
          bank: true
        }
      });
      return { code: 200, msg: "subdealer fetched", data: this.formatSubDealer(sd) };
    } catch (err) {
      logger.error("CONTROLLER.SUBDEALER.getOne", err);
      throw { code: 500, message: "error getting subdealer", data: err };
    }
  };

  getAll = async () => {
    try {
      const all = await prisma.subDealer.findMany({
        include: {
          address: { include: { district: true, state: true, country: true } },
          shippingAddress: { include: { district: true, state: true, country: true } },
          contact: true,
          bank: true
        }
      });
      return { code: 200, msg: "All subdealers fetched", data: all.map(sd => this.formatSubDealer(sd)) };
    } catch (err) {
      logger.error("CONTROLLER.SUBDEALER.getAll", err);
      throw { code: 500, message: "error getting all subdealers", data: err };
    }
  };

  getPage = async (data) => {
    try {
      let inputValue = data.searchString ? data.searchString : "";
      const { page, size } = data;
      const skip = (page - 1) * size;

      const subdealers = await prisma.subDealer.findMany({
        where: {
          name: { contains: inputValue, mode: "insensitive" }
        },
        include: {
          address: { include: { district: true, state: true, country: true } },
          shippingAddress: { include: { district: true, state: true, country: true } },
          contact: true,
          bank: true
        },
        take: size,
        skip: skip
      });

      const count = await prisma.subDealer.count({
        where: {
          name: { contains: inputValue, mode: "insensitive" }
        }
      });

      return {
        code: 200,
        msg: "subdealer fetched",
        data: { count, subdealer: subdealers.map(sd => this.formatSubDealer(sd)) },
      };
    } catch (err) {
      logger.error("CONTROLLER.SUBDEALER.getPage", err);
      throw { code: 500, message: "error getting subdealers page", data: err };
    }
  };

  deletePhone = async (id) => {
    try {
      await prisma.subDealerContact.delete({ where: { id } });
      return { code: 200, message: "Phone deleted permanently." };
    } catch (err) {
      logger.error("CONTROLLER.SUBDEALER.deletePhone", err);
      throw { code: 500, message: "error deleting phone", data: err };
    }
  };

  deleteBank = async (id) => {
    try {
      await prisma.bankDetails.delete({ where: { id } });
      return { code: 200, message: "Bank deleted permanently." };
    } catch (err) {
      logger.error("CONTROLLER.SUBDEALER.deleteBank", err);
      throw { code: 500, message: "error deleting bank", data: err };
    }
  };
}

export default new SubDealerController();

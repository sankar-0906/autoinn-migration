import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Supplier operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class SupplierController {
  // Shared include object to mirror the legacy fragment
  supplierInclude = {
    address: { include: { district: true, state: true, country: true } },
    shippingAddress: { include: { district: true, state: true, country: true } },
    contact: true,
    bank: true
  };
  formatSupplier(s) {
    if (!s) return null;
    // Legacy parity: ensure TitleCase types if they come as UPPERCASE from DB
    const formattedTypes = (s.supplierType || []).map(t => {
      if (t === 'VEHICLE') return 'Vehicles';
      if (t === 'SPARES') return 'Spares';
      return t;
    });

    // Legacy parity: ensure both plural and singular versions are present if missing
    if (formattedTypes.includes('Vehicles') && !formattedTypes.includes('Vehicle')) formattedTypes.push('Vehicle');
    if (formattedTypes.includes('Spares') && !formattedTypes.includes('Spare')) formattedTypes.push('Spare');

    return {
      ...s,
      address: s.address ? {
        ...s.address,
        district: s.address.district ? {
          ...s.address.district,
          state: s.address.district.stateId || s.address.stateId, // Legacy expected ID here
          country: s.address.countryId
        } : { id: null, name: "" },
        state: s.address.state || { id: null, name: "" },
        country: s.address.country || { id: null, name: "" },
      } : null,
      shippingAddress: s.shippingAddress ? {
        ...s.shippingAddress,
        district: s.shippingAddress.district ? {
          ...s.shippingAddress.district,
          state: s.shippingAddress.district.stateId || s.shippingAddress.stateId,
          country: s.shippingAddress.countryId
        } : { id: null, name: "" },
        state: s.shippingAddress.state || { id: null, name: "" },
        country: s.shippingAddress.country || { id: null, name: "" },
      } : null,
      supplierType: formattedTypes,
      contact: s.contact || [],
      bank: s.bank || []
    };
  }

  createSupplier = async (req) => {
    try {
      const {
        name, dealerType, GSTIN, status, email, remarks,
        shippingLine1, shippingLine2, shippingLine3, shippingLocality,
        shippingPincode, shippingCountry, shippingDistrict, shippingState,
        address, contact, bank, supplierType
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.supplier.create({
        data: {
          name,
          dealerType,
          GSTIN,
          status: status || "ACTIVE",
          email,
          remarks,
          supplierType: { set: supplierType || [] },
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
              district: { connect: { id: address.district } },
              state: { connect: { id: address.state } },
              country: { connect: { id: address.country } }
            }
          } : undefined,
          shippingAddress: shippingLine1 ? {
            create: {
              line1: shippingLine1,
              line2: shippingLine2,
              line3: shippingLine3,
              locality: shippingLocality,
              pincode: shippingPincode,
              createdAt: new Date(),
              updatedAt: new Date(),
              district: shippingDistrict ? { connect: { id: shippingDistrict } } : undefined,
              state: shippingState ? { connect: { id: shippingState } } : undefined,
              country: shippingCountry ? { connect: { id: shippingCountry } } : undefined
            }
          } : undefined,
          contact: contact && contact.length > 0 ? {
            create: contact.map(con => ({
              name: con.name,
              designation: con.designation,
              number: con.number,
              whatsapp: con.whatsapp,
              valid: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: user ? { connect: { id: user } } : undefined
            }))
          } : undefined,
          bank: bank && bank.length > 0 ? {
            create: bank.map(ban => ({
              name: ban.name,
              accountName: ban.accountName,
              accountNumber: ban.accountNumber,
              ifsc: ban.ifsc,
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: user ? { connect: { id: user } } : undefined
            }))
          } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined
        },
        include: this.supplierInclude
      });

      return {
        code: 200,
        response: {
          code: 200,
          data: this.formatSupplier(created)
        }
      };
    } catch (err) {
      logger.error("Create supplier error:", err);
      return { code: 500, response: { code: 500, message: "An error occured", error: err.message } };
    }
  };

  getAll = async () => {
    try {
      const suppliers = await prisma.supplier.findMany({
        include: this.supplierInclude
      });

      return {
        code: 200,
        response: {
          code: 200,
          data: suppliers.map(s => this.formatSupplier(s))
        }
      };
    } catch (err) {
      logger.error("Get all suppliers error:", err);
      return { code: 500, response: { code: 500, message: "An error occured" } };
    }
  };

  getOne = async (id) => {
    try {
      const supplier = await prisma.supplier.findUnique({
        where: { id },
        include: this.supplierInclude
      });

      if (supplier) {
        return {
          code: 200,
          response: {
            code: 200,
            data: this.formatSupplier(supplier)
          }
        };
      }
      return { code: 404, response: { code: 404, message: "Not found" } };
    } catch (err) {
      logger.error("Get one supplier error:", err);
      return { code: 500, response: { code: 500, message: "Server error, Please check the logs" } };
    }
  };

  getPage = async (req) => {
    try {
      const { page, size, searchString } = req.body;
      const skip = (page - 1) * size;
      const inputValue = searchString || "";
      const tCased = await titleCase(inputValue);

      const where = {
        OR: [
          { name: { contains: inputValue, mode: 'insensitive' } },
          { name: { contains: tCased, mode: 'insensitive' } },
          { email: { contains: inputValue, mode: 'insensitive' } },
          { GSTIN: { contains: inputValue, mode: 'insensitive' } }
        ]
      };

      const [suppliers, count] = await Promise.all([
        prisma.supplier.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.supplierInclude
        }),
        prisma.supplier.count({ where })
      ]);

      return {
        code: 200,
        response: {
          code: 200,
          data: { count, supplier: suppliers.map(s => this.formatSupplier(s)) }
        }
      };
    } catch (err) {
      logger.error("Get supplier page error:", err);
      return { code: 500, response: { code: 500, message: "an error occurred" } };
    }
  };

  updateSupplier = async (req) => {
    try {
      const { id } = req.params;
      const {
        name, dealerType, GSTIN, status, email, remarks,
        shippingLine1, shippingLine2, shippingLine3, shippingLocality,
        shippingPincode, shippingCountry, shippingDistrict, shippingState,
        address, contact, bank, supplierType
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const updated = await prisma.supplier.update({
        where: { id },
        data: {
          name,
          dealerType,
          GSTIN,
          status,
          email,
          remarks,
          supplierType: { set: supplierType || [] },
          updatedAt: new Date(),
          address: address ? {
            upsert: {
              create: {
                line1: address.line1,
                line2: address.line2,
                line3: address.line3,
                locality: address.locality,
                pincode: address.pincode,
                createdAt: new Date(),
                updatedAt: new Date(),
                district: { connect: { id: address.district } },
                state: { connect: { id: address.state } },
                country: { connect: { id: address.country } }
              },
              update: {
                line1: address.line1,
                line2: address.line2,
                line3: address.line3,
                locality: address.locality,
                pincode: address.pincode,
                updatedAt: new Date(),
                district: { connect: { id: address.district } },
                state: { connect: { id: address.state } },
                country: { connect: { id: address.country } }
              }
            }
          } : undefined,
          shippingAddress: shippingLine1 ? {
            upsert: {
              create: {
                line1: shippingLine1,
                line2: shippingLine2,
                line3: shippingLine3,
                locality: shippingLocality,
                pincode: shippingPincode,
                createdAt: new Date(),
                updatedAt: new Date(),
                district: shippingDistrict ? { connect: { id: shippingDistrict } } : undefined,
                state: shippingState ? { connect: { id: shippingState } } : undefined,
                country: shippingCountry ? { connect: { id: shippingCountry } } : undefined
              },
              update: {
                line1: shippingLine1,
                line2: shippingLine2,
                line3: shippingLine3,
                locality: shippingLocality,
                pincode: shippingPincode,
                updatedAt: new Date(),
                district: shippingDistrict ? { connect: { id: shippingDistrict } } : undefined,
                state: shippingState ? { connect: { id: shippingState } } : undefined,
                country: shippingCountry ? { connect: { id: shippingCountry } } : undefined
              }
            }
          } : undefined,
          contact: contact && contact.length > 0 ? {
            upsert: contact.map(con => ({
              where: { id: con.id || "new-contact" },
              create: {
                name: con.name,
                designation: con.designation,
                number: con.number,
                whatsapp: con.whatsapp,
                valid: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: user ? { connect: { id: user } } : undefined
              },
              update: {
                name: con.name,
                designation: con.designation,
                number: con.number,
                whatsapp: con.whatsapp,
                valid: true,
                updatedAt: new Date()
              }
            }))
          } : undefined,
          bank: bank && bank.length > 0 ? {
            upsert: bank.map(ban => ({
              where: { id: ban.id || "new-bank" },
              create: {
                name: ban.name,
                accountName: ban.accountName,
                accountNumber: ban.accountNumber,
                ifsc: ban.ifsc,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: user ? { connect: { id: user } } : undefined
              },
              update: {
                name: ban.name,
                accountName: ban.accountName,
                accountNumber: ban.accountNumber,
                ifsc: ban.ifsc,
                updatedAt: new Date()
              }
            }))
          } : undefined
        },
        include: this.supplierInclude
      });

      return {
        code: 200,
        response: {
          code: 200,
          data: this.formatSupplier(updated)
        }
      };
    } catch (err) {
      logger.error("Update supplier error:", err);
      return { code: 500, response: { code: 500, message: "An error occured" } };
    }
  };

  deleteSupplier = async (id) => {
    try {
      await prisma.supplier.delete({ where: { id } });
      return {
        code: 200,
        response: {
          code: 200,
          message: "Supplier deleted permanently."
        }
      };
    } catch (err) {
      logger.error("Delete supplier error:", err);
      return { code: 500, response: { code: 500, message: "an error occurred" } };
    }
  };

  deletePhone = async (id) => {
    try {
      await prisma.supplierContact.delete({ where: { id } });
      return {
        code: 200,
        response: {
          code: 200,
          message: "Phone deleted permanently."
        }
      };
    } catch (err) {
      logger.error("Delete phone error:", err);
      return { code: 500, response: { code: 500, message: "an error occurred" } };
    }
  };

  deleteBank = async (id) => {
    try {
      await prisma.bankDetails.delete({ where: { id } });
      return {
        code: 200,
        response: {
          code: 200,
          message: "Bank deleted permanently."
        }
      };
    } catch (err) {
      logger.error("Delete bank error:", err);
      return { code: 500, response: { code: 500, message: "an error occurred" } };
    }
  };
}

export default new SupplierController();

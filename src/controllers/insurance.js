import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Insurance operations.
 * Maintained with payload parity with autoinn-be.
 */
class InsuranceController {
  // Shared include object to mirror the legacy fragment
  insuranceInclude = {
    address: {
      include: {
        district: true,
        state: true,
        country: true
      }
    },
    shippingAddress: {
      include: {
        district: true,
        state: true,
        country: true
      }
    },
    contact: true
  };

  createInsurance = async (req, res) => {
    try {
      const {
        name,
        dealerType,
        GSTIN,
        status,
        email,
        cashless,
        shippingLine1,
        shippingLine2,
        shippingLine3,
        shippingLocality,
        shippingCountry,
        shippingDistrict,
        shippingState,
        shippingPincode,
        logo,
        address,
        contact
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      // Helper to get ID from potential object or string
      const getId = (val) => (val && typeof val === 'object' ? val.id : val);

      const created = await prisma.insurance.create({
        data: {
          name,
          dealerType,
          GSTIN,
          status,
          email,
          logo,
          cashless,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: user ? { connect: { id: user } } : undefined,
          address: address ? {
            create: {
              line1: address.line1,
              line2: address.line2,
              line3: address.line3,
              locality: address.locality,
              district: getId(address.district) ? { connect: { id: getId(address.district) } } : undefined,
              state: getId(address.state) ? { connect: { id: getId(address.state) } } : undefined,
              country: getId(address.country) ? { connect: { id: getId(address.country) } } : undefined,
              pincode: address.pincode,
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: user ? { connect: { id: user } } : undefined
            }
          } : undefined,
          shippingAddress: (shippingLine1 || shippingLine2 || shippingLine3) ? {
            create: {
              line1: shippingLine1,
              line2: shippingLine2,
              line3: shippingLine3,
              locality: shippingLocality,
              district: getId(shippingDistrict) ? { connect: { id: getId(shippingDistrict) } } : undefined,
              state: getId(shippingState) ? { connect: { id: getId(shippingState) } } : undefined,
              country: getId(shippingCountry) ? { connect: { id: getId(shippingCountry) } } : undefined,
              pincode: shippingPincode,
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: user ? { connect: { id: user } } : undefined
            }
          } : undefined,
          contact: contact && contact.length > 0 ? {
            create: contact.map(con => ({
              name: con.name,
              designation: con.designation,
              number: con.number,
              whatsapp: con.whatsapp || false,
              valid: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: user ? { connect: { id: user } } : undefined
            }))
          } : undefined
        },
        include: this.insuranceInclude
      });

      logger.info(`Insurance created: ${created.id} by user: ${user}`);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Insurance created",
          data: created
        }
      });
    } catch (err) {
      logger.error("Create insurance error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  updateInsurance = async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        dealerType,
        GSTIN,
        status,
        email,
        cashless,
        shippingLine1,
        shippingLine2,
        shippingLine3,
        shippingLocality,
        shippingCountry,
        shippingDistrict,
        shippingState,
        shippingPincode,
        logo,
        address,
        contact
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const getId = (val) => (val && typeof val === 'object' ? val.id : val);

      // Update basic fields
      const insurance = await prisma.insurance.findUnique({ where: { id } });
      if (!insurance) return res.status(404).json({ code: 404, message: "Insurance not found" });

      const updated = await prisma.insurance.update({
        where: { id },
        data: {
          name,
          dealerType,
          GSTIN,
          status,
          email,
          logo,
          cashless,
          updatedAt: new Date(),
        },
        include: this.insuranceInclude
      });

      // Update address if provided
      if (address) {
        if (updated.addressId) {
          await prisma.address.update({
            where: { id: updated.addressId },
            data: {
              line1: address.line1,
              line2: address.line2,
              line3: address.line3,
              locality: address.locality,
              districtId: getId(address.district),
              stateId: getId(address.state),
              countryId: getId(address.country),
              pincode: address.pincode,
              updatedAt: new Date()
            }
          });
        } else {
          // Create address if it didn't exist
          const newAddr = await prisma.address.create({
            data: {
              line1: address.line1,
              line2: address.line2,
              line3: address.line3,
              locality: address.locality,
              districtId: getId(address.district),
              stateId: getId(address.state),
              countryId: getId(address.country),
              pincode: address.pincode,
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: user ? { connect: { id: user } } : undefined
            }
          });
          await prisma.insurance.update({
            where: { id },
            data: { addressId: newAddr.id }
          });
        }
      }

      // Update shipping address
      if (shippingLine1 || shippingLine2 || shippingLine3) {
        if (updated.shippingAddressId) {
          await prisma.address.update({
            where: { id: updated.shippingAddressId },
            data: {
              line1: shippingLine1,
              line2: shippingLine2,
              line3: shippingLine3,
              locality: shippingLocality,
              districtId: getId(shippingDistrict),
              stateId: getId(shippingState),
              countryId: getId(shippingCountry),
              pincode: shippingPincode,
              updatedAt: new Date()
            }
          });
        } else {
          const newSAddr = await prisma.address.create({
            data: {
              line1: shippingLine1,
              line2: shippingLine2,
              line3: shippingLine3,
              locality: shippingLocality,
              districtId: getId(shippingDistrict),
              stateId: getId(shippingState),
              countryId: getId(shippingCountry),
              pincode: shippingPincode,
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: user ? { connect: { id: user } } : undefined
            }
          });
          await prisma.insurance.update({
            where: { id },
            data: { shippingAddressId: newSAddr.id }
          });
        }
      }

      // Update contacts
      if (contact) {
        await prisma.insuranceContact.deleteMany({ where: { insuranceId: id } });
        if (contact.length > 0) {
          await prisma.insuranceContact.createMany({
            data: contact.map(con => ({
              insuranceId: id,
              name: con.name,
              designation: con.designation,
              number: con.number,
              whatsapp: con.whatsapp || false,
              valid: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              createdById: user
            }))
          });
        }
      }

      const finalResult = await prisma.insurance.findUnique({
        where: { id },
        include: this.insuranceInclude
      });

      logger.info(`Insurance updated: ${id}`);

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Insurance Saved Successfully",
          data: finalResult
        }
      });
    } catch (err) {
      logger.error("Update insurance error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  deleteInsurance = async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user?.id || req.headers["user-id"];

      try {
        await prisma.insurance.delete({
          where: { id }
        });
      } catch (prismaErr) {
        if (prismaErr.code === 'P2003') { // Foreign key constraint failed
          return res.json({
            code: 200,
            response: {
              code: 400,
              message: "Alert: This Insurance is already in use."
            }
          });
        }
        throw prismaErr;
      }

      logger.info(`Insurance deleted: ${id} by user: ${user}`);

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Deleted Sucessfully"
        }
      });
    } catch (err) {
      logger.error("Delete insurance error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const insurance = await prisma.insurance.findUnique({
        where: { id },
        include: this.insuranceInclude
      });

      if (insurance) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "Insurance fetched",
            data: insurance
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one insurance error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getAll = async (req, res) => {
    try {
      const insurances = await prisma.insurance.findMany({
        include: this.insuranceInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "All insurances fetched",
          data: insurances
        }
      });
    } catch (err) {
      logger.error("Get all insurances error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString } = req.body;
      const parsedPage = parseInt(page) || 1;
      const parsedSize = size ? parseInt(size) : undefined;
      const skip = parsedSize ? (parsedPage - 1) * parsedSize : undefined;
      const inputValue = searchString || "";
      const tCased = await titleCase(inputValue);

      const where = {
        OR: [
          { name: { contains: inputValue, mode: 'insensitive' } },
          { name: { contains: tCased, mode: 'insensitive' } },
          { name: { contains: inputValue.toLowerCase(), mode: 'insensitive' } },
          { name: { contains: inputValue.toUpperCase(), mode: 'insensitive' } }
        ]
      };

      const [insurances, count] = await Promise.all([
        prisma.insurance.findMany({
          where,
          take: parsedSize,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.insuranceInclude
        }),
        prisma.insurance.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Insurance fetched",
          data: { count, insurance: insurances }
        }
      });
    } catch (err) {
      logger.error("Get insurance page error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };
}

export default new InsuranceController();

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

  createSupplier = async (req, res) => {
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
              createdBy: user ? { connect: { id: user } } : undefined
            }))
          } : undefined,
          bank: bank && bank.length > 0 ? {
            create: bank.map(ban => ({
              name: ban.name,
              accountName: ban.accountName,
              accountNumber: ban.accountNumber,
              ifsc: ban.ifsc,
              createdBy: user ? { connect: { id: user } } : undefined
            }))
          } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined
        },
        include: this.supplierInclude
      });

      return res.json({
        code: 200,
        response: created
      });
    } catch (err) {
      logger.error("Create supplier error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getAll = async (req, res) => {
    try {
      const suppliers = await prisma.supplier.findMany({
        include: this.supplierInclude
      });

      return res.json({
        code: 200,
        response: suppliers
      });
    } catch (err) {
      logger.error("Get all suppliers error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const supplier = await prisma.supplier.findUnique({
        where: { id },
        include: this.supplierInclude
      });

      if (supplier) {
        return res.json({
          code: 200,
          response: supplier
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one supplier error:", err);
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

      return res.json({
        code: 200,
        response: { count, supplier: suppliers }
      });
    } catch (err) {
      logger.error("Get supplier page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };
}

export default new SupplierController();

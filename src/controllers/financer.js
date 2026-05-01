import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Financer operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class FinancerController {
  // Shared include object to mirror the legacy fragment
  financerInclude = {
    address: {
      include: {
        district: true,
        state: true,
        country: true
      }
    },
    contact: true
  };

  createFinancer = async (req, res) => {
    try {
      const {
        name, dealerType, GSTIN, status, email, logo, address, contact
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.financer.create({
        data: {
          name,
          dealerType,
          GSTIN,
          status,
          email,
          logo,
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
              createdBy: user ? { connect: { id: user } } : undefined
            }
          } : undefined,
          contact: contact && contact.length > 0 ? {
            create: contact.map(c => ({
              name: c.name,
              designation: c.designation,
              number: c.number,
              whatsapp: c.whatsapp,
              valid: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: user ? { connect: { id: user } } : undefined
            }))
          } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined
        },
        include: this.financerInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Financer created",
          data: created
        }
      });
    } catch (err) {
      logger.error("Create financer error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  updateFinancer = async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name, dealerType, GSTIN, status, email, logo, address, contact
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      // Handle contact updates/deletions/creations
      // For simplicity and parity with legacy's manual diffing:
      if (contact) {
        const existingContacts = await prisma.financerContact.findMany({
          where: { financerId: id },
          select: { id: true }
        });
        const existingIds = existingContacts.map(c => c.id);
        const incomingIds = contact.filter(c => c.id).map(c => c.id);
        const deletedIds = existingIds.filter(oldId => !incomingIds.includes(oldId));

        if (deletedIds.length > 0) {
          await prisma.financerContact.deleteMany({
            where: { id: { in: deletedIds } }
          });
        }
      }

      const updated = await prisma.financer.update({
        where: { id },
        data: {
          name,
          dealerType,
          GSTIN,
          status,
          email,
          logo,
          updatedAt: new Date(),
          address: address ? {
            upsert: {
              update: {
                line1: address.line1,
                line2: address.line2,
                line3: address.line3,
                locality: address.locality,
                pincode: address.pincode,
                district: address.district ? { connect: { id: address.district } } : undefined,
                state: address.state ? { connect: { id: address.state } } : undefined,
                country: address.country ? { connect: { id: address.country } } : undefined,
              },
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
                createdBy: user ? { connect: { id: user } } : undefined
              }
            }
          } : undefined,
          contact: contact ? {
            upsert: contact.filter(c => c.id).map(c => ({
              where: { id: c.id },
              update: {
                name: c.name,
                designation: c.designation,
                number: c.number,
                whatsapp: c.whatsapp,
                valid: c.valid
              },
              create: {
                name: c.name,
                designation: c.designation,
                number: c.number,
                whatsapp: c.whatsapp,
                valid: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: user ? { connect: { id: user } } : undefined
              }
            })),
            create: contact.filter(c => !c.id).map(c => ({
              name: c.name,
              designation: c.designation,
              number: c.number,
              whatsapp: c.whatsapp,
              valid: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: user ? { connect: { id: user } } : undefined
            }))
          } : undefined
        },
        include: this.financerInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Financier updated",
          data: updated
        }
      });
    } catch (err) {
      logger.error("Update financer error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const financer = await prisma.financer.findUnique({
        where: { id },
        include: this.financerInclude
      });

      if (financer) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "Financer fetched",
            data: financer
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one financer error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
    }
  };

  getAll = async (req, res) => {
    try {
      const financers = await prisma.financer.findMany({
        include: this.financerInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "All financers fetched",
          data: financers
        }
      });
    } catch (err) {
      logger.error("Get all financers error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  deleteFinancer = async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.financer.delete({ where: { id } });
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Financer deleted permanently."
        }
      });
    } catch (err) {
      logger.error("Delete financer error:", err);
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

      const [financers, count] = await Promise.all([
        prisma.financer.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.financerInclude
        }),
        prisma.financer.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Financers  fetched",
          data: { count, financer: financers }
        }
      });
    } catch (err) {
      logger.error("Get financer page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };
}

export default new FinancerController();

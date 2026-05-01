import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Enquiry operations.
 * Maintained with 100% payload parity with autoinn-be.
 * Note: Enquiries in the legacy system use the Customer model.
 */
class EnquiryController {
  // Shared include object for Enquiry (subset of Customer)
  enquiryInclude = {
    contacts: true,
    address: true,
    quotation: true
  };

  createEnquiry = async (req, res) => {
    try {
      const { customerId, name, phone } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      // Check for duplicate enquiry (customer with same phone/name)
      const duplicate = await prisma.customer.findFirst({
        where: {
          name,
          contacts: { some: { phone } }
        }
      });

      if (duplicate) {
        return res.json({
          code: 400,
          msg: "Enquiry with phone already exists",
        });
      }

      const created = await prisma.customer.create({
        data: {
          customerId,
          name,
          createdAt: new Date(),
          updatedAt: new Date(),
          contacts: {
            create: {
              phone,
              type: "Primary",
              valid: true,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          },
          createdBy: user ? { connect: { id: user } } : undefined
        },
        include: this.enquiryInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Enquiry created",
          data: created
        }
      });
    } catch (err) {
      logger.error("Create enquiry error:", err);
      return res.json({ code: 500, msg: "An error occured", err: err.message });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const enquiry = await prisma.customer.findUnique({
        where: { id },
        include: this.enquiryInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Enquiry fetched",
          data: enquiry
        }
      });
    } catch (err) {
      logger.error("Get one enquiry error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
    }
  };

  getByPhone = async (req, res) => {
    try {
      const { id } = req.params; // Phone number
      const enquiries = await prisma.customer.findMany({
        where: {
          contacts: { some: { phone: id } }
        },
        include: this.enquiryInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Enquiry fetched",
          data: enquiries
        }
      });
    } catch (err) {
      logger.error("Get enquiry by phone error:", err);
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
          { name: { contains: tCased, mode: 'insensitive' } }
        ]
      };

      const [customers, count] = await Promise.all([
        prisma.customer.findMany({
          where,
          take: size,
          skip,
          include: this.enquiryInclude
        }),
        prisma.customer.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Customers  fetched",
          data: { count, customer: customers }
        }
      });
    } catch (err) {
      logger.error("Get enquiry page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };
}

export default new EnquiryController();

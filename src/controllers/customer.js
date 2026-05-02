import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Customer operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class CustomerController {
  // Shared include object to mirror the legacy fragment
  customerInclude = {
    CustomerPhone: true,
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
    refferedBy: {
      include: {
        CustomerPhone: true
      }
    },
    quotation: {
      include: {
        QuotationVehicle: {
          include: {
            vehicleDetail: {
              include: {
                Manufacturer: true,
                images: true,
                prices: true
              }
            }
          }
        },
        executive: true
      }
    },
    booking: {
      include: {
        vehicle: {
          include: {
            Manufacturer: true,
            prices: true
          }
        },
        color: true
      }
    }
  };

  formatCustomer = (c) => {
    if (!c) return c;
    const formatted = {
      ...c,
      contacts: c.CustomerPhone,
    };

    if (formatted.refferedBy) {
        formatted.refferedBy = {
            ...formatted.refferedBy,
            contacts: formatted.refferedBy.CustomerPhone
        };
    }

    if (formatted.quotation) {
        formatted.quotation = formatted.quotation.map(q => ({
            ...q,
            vehicle: q.QuotationVehicle?.length > 0 ? {
                ...q.QuotationVehicle[0],
                vehicleDetail: q.QuotationVehicle[0].vehicleDetail ? {
                    ...q.QuotationVehicle[0].vehicleDetail,
                    manufacturer: q.QuotationVehicle[0].vehicleDetail.Manufacturer,
                    image: q.QuotationVehicle[0].vehicleDetail.images,
                    price: q.QuotationVehicle[0].vehicleDetail.prices
                } : null
            } : null
        }));
    }

    if (formatted.booking) {
        formatted.booking = formatted.booking.map(b => ({
            ...b,
            vehicle: b.vehicle ? {
                ...b.vehicle,
                manufacturer: b.vehicle.Manufacturer,
                price: b.vehicle.prices
            } : null
        }));
    }

    return formatted;
  };

  createCustomer = async (req, res) => {
    try {
      const {
        customerId, salutation, name, fatherName, gender, email,
        contacts, address, shippingAddress, GSTType, GSTNo,
        customerType, customerGrouping, dateOfBirth
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.customer.create({
        data: {
          customerId,
          salutation,
          name,
          fatherName,
          gender,
          email,
          GSTType,
          GSTNo,
          customerType,
          customerGrouping,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
          CustomerPhone: contacts && contacts.length > 0 ? {
            create: contacts.map(c => ({
              phone: c.phone,
              type: c.type,
              valid: c.valid !== undefined ? c.valid : true,
              DND: c.DND !== undefined ? c.DND : false,
              WhatsApp: c.WhatsApp !== undefined ? c.WhatsApp : false,
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: user ? { connect: { id: user } } : undefined
            }))
          } : undefined,
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
          shippingAddress: shippingAddress ? {
            create: {
              line1: shippingAddress.line1,
              line2: shippingAddress.line2,
              line3: shippingAddress.line3,
              locality: shippingAddress.locality,
              pincode: shippingAddress.pincode,
              createdAt: new Date(),
              updatedAt: new Date(),
              district: shippingAddress.district ? { connect: { id: shippingAddress.district } } : undefined,
              state: shippingAddress.state ? { connect: { id: shippingAddress.state } } : undefined,
              country: shippingAddress.country ? { connect: { id: shippingAddress.country } } : undefined,
            }
          } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined
        },
        include: this.customerInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Customer created",
          data: this.formatCustomer(created)
        }
      });
    } catch (err) {
      logger.error("Create customer error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const customer = await prisma.customer.findUnique({
        where: { id },
        include: this.customerInclude
      });

      if (customer) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "customer fetched",
            data: this.formatCustomer(customer)
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one customer error:", err);
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
          { customerId: { contains: inputValue, mode: 'insensitive' } },
          { CustomerPhone: { some: { phone: { contains: inputValue } } } }
        ]
      };

      const [customers, count] = await Promise.all([
        prisma.customer.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.customerInclude
        }),
        prisma.customer.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Customers  fetched",
          data: { count, customer: customers.map(c => this.formatCustomer(c)) }
        }
      });
    } catch (err) {
      logger.error("Get customer page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  getByPhone = async (req, res) => {
    try {
      const { id } = req.params; // Phone number
      const customers = await prisma.customer.findMany({
        where: {
          CustomerPhone: {
            some: { phone: id }
          }
        },
        include: this.customerInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "customer fetched",
          data: customers[0] ? this.formatCustomer(customers[0]) : null
        }
      });
    } catch (err) {
      logger.error("Get customer by phone error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
    }
  };

  digitalLeads = async (req, res) => {
    try {
      const { name, phone, enquiryType } = req.body;
      const lead = await prisma.digitalLead.create({
        data: {
          name,
          phone,
          enquiryType,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Digital lead created",
          data: lead
        }
      });
    } catch (err) {
      logger.error("Digital lead error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };
}

export default new CustomerController();

import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Booking operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class BookingController {
  // Shared include object for Booking
  bookingInclude = {
    customer: {
      include: {
        contacts: true,
        address: { include: { district: true, state: true, country: true } },
        refferedBy: true
      }
    },
    branch: {
      include: {
        address: { include: { district: true, state: true } }
      }
    },
    vehicle: {
      include: {
        manufacturer: true,
        price: true
      }
    },
    color: true,
    loan: {
      include: {
        financer: true
      }
    },
    executive: {
      include: {
        profile: true
      }
    },
    quotation: true,
    exchange: true
  };

  createBooking = async (req, res) => {
    try {
      const {
        bookingId, bookingStatus, expectedDeliveryDate, customer, branch,
        vehicle, color, loan, executive, remarks, finalAmount
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.booking.create({
        data: {
          bookingId,
          bookingStatus,
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
          remarks,
          finalAmount: parseFloat(finalAmount) || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          customer: customer ? { connect: { id: customer } } : undefined,
          branch: branch ? { connect: { id: branch } } : undefined,
          vehicle: vehicle ? { connect: { id: vehicle } } : undefined,
          color: color ? { connect: { id: color } } : undefined,
          executive: executive ? { connect: { id: executive } } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined,
          loan: loan ? {
            create: {
              financer: loan.financer ? { connect: { id: loan.financer } } : undefined,
              loanAmount: parseFloat(loan.loanAmount) || 0,
              tenure: parseInt(loan.tenure) || 0,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          } : undefined
        },
        include: this.bookingInclude
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Booking created",
          data: created
        }
      });
    } catch (err) {
      logger.error("Create booking error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: this.bookingInclude
      });

      if (booking) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "Booking fetched",
            data: booking
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one booking error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString } = req.body;
      const branchIds = req.user?.branch || [];
      const skip = (page - 1) * size;
      const inputValue = searchString || "";

      const where = {
        branchId: { in: Array.isArray(branchIds) ? branchIds : [branchIds] },
        OR: [
          { bookingId: { contains: inputValue, mode: 'insensitive' } },
          { customerName: { contains: inputValue, mode: 'insensitive' } }
        ]
      };

      const [bookings, count] = await Promise.all([
        prisma.booking.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.bookingInclude
        }),
        prisma.booking.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "bookings fetched",
          data: { count, booking: bookings }
        }
      });
    } catch (err) {
      logger.error("Get booking page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };
}

export default new BookingController();

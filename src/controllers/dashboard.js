import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";

/**
 * Controller for Dashboard statistics.
 * Maintained with high payload parity with legacy autoinn-be.
 */
class DashboardController {
  getData = async (req, res) => {
    try {
      const { fromDate, toDate, executiveIds = [] } = req.body;
      const start = fromDate ? new Date(fromDate) : new Date(new Date().setHours(0,0,0,0));
      const end = toDate ? new Date(toDate) : new Date(new Date().setHours(23,59,59,999));

      const queryExecs = executiveIds.length > 0 ? executiveIds : undefined;

      // Base filters
      const baseFilter = {
        createdAt: { gte: start, lte: end },
        executiveId: queryExecs ? { in: queryExecs } : undefined
      };

      // Parallel aggregation for performance
      const [
        quotationCount,
        bookingCount,
        soldVehicleCount,
        hotCount,
        coldCount,
        warmCount,
        walkInCount,
        callEnquiryCount,
        referralCount,
        quotations,
        bookings
      ] = await Promise.all([
        prisma.quotation.count({ where: baseFilter }),
        prisma.booking.count({ where: baseFilter }),
        prisma.booking.count({
          where: { ...baseFilter, bookingStatus: "SOLD" }
        }),
        prisma.quotation.count({
          where: { ...baseFilter, enquiryType: "HOT" }
        }),
        prisma.quotation.count({
          where: { ...baseFilter, enquiryType: "COLD" }
        }),
        prisma.quotation.count({
          where: { ...baseFilter, enquiryType: "WARM" }
        }),
        prisma.quotation.count({
          where: { ...baseFilter, leadSource: "WALK IN" }
        }),
        prisma.quotation.count({
          where: { ...baseFilter, leadSource: "CALL ENQUIRY" }
        }),
        prisma.quotation.count({
          where: { ...baseFilter, leadSource: "REFERRAL" }
        }),
        prisma.quotation.findMany({
          where: baseFilter,
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: true,
            vehicle: { include: { vehicleDetail: true } }
          }
        }),
        prisma.booking.findMany({
          where: baseFilter,
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: true,
            vehicle: true
          }
        })
      ]);

      // Wrap in the same structure as legacy DashboardRoutes + Controller
      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Data fetched",
          data: {
            quotationCount,
            bookingCount,
            soldVehicleCount,
            hotCount,
            coldCount,
            warmCount,
            walkInCount,
            callEnquiryCount,
            referralCount,
            socialMediaCount: 0,
            smsCount: 0,
            newspaperCount: 0,
            televisionAdCount: 0,
            leafletCount: 0,
            todaysTask: [],
            quotations,
            bookings,
            todaysTaskCount: 0,
            salesTargetCount: 0,
            rampsSummary: null
          }
        }
      });
    } catch (err) {
      logger.error("Dashboard stats error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getUsers = async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        where: { status: true },
        select: {
          id: true,
          phone: true,
          EmployeeProfile_User_profileToEmployeeProfile: {
            select: {
              employeeName: true,
              employeeId: true,
              department: { select: { role: true } }
            }
          }
        }
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          data: users.map(u => ({
            id: u.id,
            phone: u.phone,
            profile: u.EmployeeProfile_User_profileToEmployeeProfile
          }))
        }
      });
    } catch (err) {
      logger.error("Dashboard users error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };
}

export default new DashboardController();

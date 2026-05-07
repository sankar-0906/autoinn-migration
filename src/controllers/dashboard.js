import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";

/**
 * Controller for Dashboard statistics.
 * Maintained with high payload parity with legacy autoinn-be.
 */
class DashboardController {
  getData = async (req, res) => {
    try {
      // Use 'from', 'to', and 'employee' as per frontend Dashboard/index.jsx
      const { from, to, employee, current } = req.body;
      const moment = (await import('moment')).default;
      
      let start, end;
      if (from) {
        start = moment(from, "DD-MM-YYYY").startOf("day").toDate();
      } else {
        start = moment().startOf("month").startOf("day").toDate();
      }

      if (to) {
        end = moment(to, "DD-MM-YYYY").endOf("day").toDate();
      } else {
        end = moment().endOf("day").toDate();
      }

      // Legacy logic: if employee list is empty, use current user id
      let empList = employee;
      if (Array.isArray(empList) && empList.length > 0 && empList[0] === null) {
        empList = null;
      }
      const queryExecs = (Array.isArray(empList) && empList.length > 0) ? empList : (current ? [current] : undefined);

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
        quotationsRaw,
        bookings
      ] = await Promise.all([
        prisma.quotation.count({ where: baseFilter }),
        prisma.booking.count({ where: baseFilter }),
        prisma.booking.count({
          where: { ...baseFilter, bookingStatus: "SOLD" }
        }),
        prisma.quotation.count({
          where: { ...baseFilter, enquiryType: { equals: "HOT", mode: 'insensitive' } }
        }),
        prisma.quotation.count({
          where: { ...baseFilter, enquiryType: { equals: "COLD", mode: 'insensitive' } }
        }),
        prisma.quotation.count({
          where: { ...baseFilter, enquiryType: { equals: "WARM", mode: 'insensitive' } }
        }),
        prisma.quotation.count({
          where: { ...baseFilter, leadSource: { equals: "WALK IN", mode: 'insensitive' } }
        }),
        prisma.quotation.count({
          where: { ...baseFilter, leadSource: { equals: "CALL ENQUIRY", mode: 'insensitive' } }
        }),
        prisma.quotation.count({
          where: { ...baseFilter, leadSource: { equals: "REFERRAL", mode: 'insensitive' } }
        }),
        prisma.quotation.findMany({
          where: baseFilter,
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { include: { CustomerPhone: true } },
            executive: { include: { EmployeeProfile_User_profileToEmployeeProfile: true } },
            assignedExecutive: { include: { EmployeeProfile_User_profileToEmployeeProfile: true } },
            QuotationVehicle: { 
              include: { 
                vehicleDetail: { include: { manufacturer: true } } 
              } 
            }
          }
        }),
        prisma.booking.findMany({
          where: baseFilter,
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { include: { CustomerPhone: true } },
            vehicle: { include: { manufacturer: true } },
            executive: { include: { EmployeeProfile_User_profileToEmployeeProfile: true } },
            color: true,
            branch: true
          }
        })
      ]);

      // Map QuotationVehicle to vehicle to match frontend expectations
      const quotations = quotationsRaw.map(q => {
        const { QuotationVehicle, ...rest } = q;
        return {
          ...rest,
          vehicle: QuotationVehicle || []
        };
      });

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
      console.error("Dashboard Stats Error Stack:", err.stack);
      return res.json({ code: 500, msg: "An error occured" });
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
          msg: "Users fetched",
          data: users.map(u => ({
            id: u.id,
            phone: u.phone,
            profile: u.EmployeeProfile_User_profileToEmployeeProfile
          }))
        }
      });
    } catch (err) {
      logger.error("Dashboard users error:", err);
      console.error("Dashboard Users Error Stack:", err.stack);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };
}

export default new DashboardController();

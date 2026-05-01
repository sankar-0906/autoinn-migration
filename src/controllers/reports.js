import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import moment from "moment";

/**
 * Controller for Reporting operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class ReportController {
  
  getDateFormat = (timeline, from, to) => {
    let fromDate, toDate;
    if (timeline === "Custom") {
      fromDate = moment(from).startOf('day').toDate();
      toDate = moment(to).endOf('day').toDate();
    } else if (timeline === "Today") {
      fromDate = moment().startOf('day').toDate();
      toDate = moment().endOf('day').toDate();
    } else {
      fromDate = moment().subtract(1, 'months').startOf('day').toDate();
      toDate = moment().endOf('day').toDate();
    }
    return { fromDate, toDate };
  };

  getCategoryOfVehicleReporting = async (req, res) => {
    try {
      const { timeline, from, to, branch } = req.body;
      const { fromDate, toDate } = this.getDateFormat(timeline, from, to);
      const branchIds = branch || req.user?.branch || [];

      const [scooter, motorCycle] = await Promise.all([
        prisma.jobOrder.count({
          where: {
            branchId: { in: Array.isArray(branchIds) ? branchIds : [branchIds] },
            vehicle: { vehicle: { category: "SCOOTER" } },
            createdAt: { gte: fromDate, lte: toDate }
          }
        }),
        prisma.jobOrder.count({
          where: {
            branchId: { in: Array.isArray(branchIds) ? branchIds : [branchIds] },
            vehicle: { vehicle: { category: "MOTORCYCLE" } },
            createdAt: { gte: fromDate, lte: toDate }
          }
        })
      ]);

      return res.json({
        code: 200,
        data: { scooter, motorCycle }
      });
    } catch (err) {
      logger.error("Vehicle category report error:", err);
      return res.status(500).json({ code: 500, msg: "Something went wrong.." });
    }
  };

  getDashboardData = async (req, res) => {
    try {
      const branchIds = req.body.branch || req.user?.branch || [];
      
      const [quotationCount, bookingCount, jobOrderCount] = await Promise.all([
        prisma.quotation.count({ where: { branchId: { in: Array.isArray(branchIds) ? branchIds : [branchIds] } } }),
        prisma.booking.count({ where: { branchId: { in: Array.isArray(branchIds) ? branchIds : [branchIds] } } }),
        prisma.jobOrder.count({ where: { branchId: { in: Array.isArray(branchIds) ? branchIds : [branchIds] } } })
      ]);

      return res.json({
        code: 200,
        response: {
          quotations: quotationCount,
          bookings: bookingCount,
          jobOrders: jobOrderCount
        }
      });
    } catch (err) {
      logger.error("Dashboard report error:", err);
      return res.status(500).json({ code: 500, msg: "Something went wrong.." });
    }
  };
}

export default new ReportController();

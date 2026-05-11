import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import moment from "moment";
import { normalizeBranchIds } from "../utils/branch.util.js";

/**
 * Controller for Reporting operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class ReportController {
  
  getDateFormat = (timeline, from, to) => {
    let fromDate, toDate;
    if (timeline === "Custom" || timeline === "date") {
      fromDate = moment(from, from.includes("-") ? "DD-MM-YYYY" : undefined).startOf('day').toDate();
      toDate = moment(to, to.includes("-") ? "DD-MM-YYYY" : undefined).endOf('day').toDate();
    } else if (timeline === "Today" || timeline === "today") {
      fromDate = moment().startOf('day').toDate();
      toDate = moment().endOf('day').toDate();
    } else if (timeline === "week") {
      fromDate = moment().startOf('week').toDate();
      toDate = moment().endOf('week').toDate();
    } else if (timeline === "month") {
      fromDate = moment().startOf('month').toDate();
      toDate = moment().endOf('month').toDate();
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
      const branchArr = normalizeBranchIds(branch, req.user?.branch);

      const [scooter, motorCycle] = await Promise.all([
        prisma.jobOrder.count({
          where: {
            branchId: { in: branchArr },
            vehicle: { vehicle: { category: "SCOOTER" } },
            createdAt: { gte: fromDate, lte: toDate }
          }
        }),
        prisma.jobOrder.count({
          where: {
            branchId: { in: branchArr },
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

  getVehicleService = async (req, res) => {
    try {
      const { timeline, from, to, branch } = req.body;
      const { fromDate, toDate } = this.getDateFormat(timeline, from, to);
      const branchArr = normalizeBranchIds(branch, req.user?.branch);

      const [freeService, accidentalRepair, paidAwService, paidUwService, quickRepair] = await Promise.all([
        prisma.jobOrder.count({ where: { branchId: { in: branchArr }, serviceType: { contains: "Free" }, createdAt: { gte: fromDate, lte: toDate } } }),
        prisma.jobOrder.count({ where: { branchId: { in: branchArr }, serviceType: { contains: "Accidental" }, createdAt: { gte: fromDate, lte: toDate } } }),
        prisma.jobOrder.count({ where: { branchId: { in: branchArr }, serviceType: { contains: "Paid (AW)" }, createdAt: { gte: fromDate, lte: toDate } } }),
        prisma.jobOrder.count({ where: { branchId: { in: branchArr }, serviceType: { contains: "Paid (UW)" }, createdAt: { gte: fromDate, lte: toDate } } }),
        prisma.jobOrder.count({ where: { branchId: { in: branchArr }, serviceType: { contains: "Minor" }, createdAt: { gte: fromDate, lte: toDate } } })
      ]);

      const total = freeService + accidentalRepair + paidAwService + paidUwService + quickRepair;
      const paidService = paidAwService + paidUwService;

      return res.json({
        code: 200,
        response: { freeService, accidentalRepair, paidService, quickRepair, total }
      });
    } catch (err) {
      logger.error("Vehicle service report error:", err);
      return res.status(500).json({ code: 500, msg: "Something went wrong.." });
    }
  };

  getServiceDataList = async (req, res) => {
    try {
      const { timeline, from, to, branch } = req.body;
      const { fromDate, toDate } = this.getDateFormat(timeline, from, to);
      const branchArr = normalizeBranchIds(branch, req.user?.branch);

      const [service_1_done, service_6_done, OverAll_service_done, service_1_due, service_6_due, overAll_Service_due] = await Promise.all([
        prisma.saleSpareInvoice.count({ where: { branchId: { in: branchArr }, invoiceType: "jobOrder", jobOrder: { serviceNo: "1", jobStatus: "Proforma Invoice" }, invoiceDate: { gte: fromDate, lte: toDate } } }),
        prisma.saleSpareInvoice.count({ where: { branchId: { in: branchArr }, invoiceType: "jobOrder", jobOrder: { serviceNo: "6", jobStatus: "Proforma Invoice" }, invoiceDate: { gte: fromDate, lte: toDate } } }),
        prisma.saleSpareInvoice.count({ where: { branchId: { in: branchArr }, invoiceType: "jobOrder", jobOrder: { jobStatus: "Proforma Invoice" }, invoiceDate: { gte: fromDate, lte: toDate } } }),
        prisma.service.count({ where: { serviceNo: 1, serviceDate: { gte: fromDate, lte: toDate } } }),
        prisma.service.count({ where: { serviceNo: 6, serviceDate: { gte: fromDate, lte: toDate } } }),
        prisma.service.count({ where: { serviceDate: { gte: fromDate, lte: toDate } } })
      ]);

      return res.json({
        code: 200,
        data: { service_1_done, service_6_done, service_1_due, service_6_due, overAll_Service_due, OverAll_service_done }
      });
    } catch (err) {
      logger.error("Service data list report error:", err);
      return res.status(500).json({ code: 500, msg: "Something went wrong.." });
    }
  };

  partCharges = async (req, res) => {
    try {
      const { timeline, from, to, branch } = req.body;
      const { fromDate, toDate } = this.getDateFormat(timeline, from, to);
      const branchArr = normalizeBranchIds(branch, req.user?.branch);

      const invoices = await prisma.saleSpareInvoice.findMany({
        where: {
          invoiceType: "jobOrder",
          invoiceDate: { gte: fromDate, lte: toDate },
          jobOrder: { jobStatus: "Proforma Invoice" },
          branchId: { in: branchArr }
        },
        include: {
          saleItemInvoice: {
            include: { jobCode: true }
          },
          jobOrder: {
            include: { vehicle: true }
          }
        }
      });

      let labourCharge = 0, partsCharge = 0, consumableCharge = 0;
      const uniqueVehicles = new Set();

      invoices.forEach(inv => {
        if (inv.jobOrder?.vehicle?.registerNo) {
          uniqueVehicles.add(inv.jobOrder.vehicle.registerNo);
        }
        inv.saleItemInvoice.forEach(item => {
          const amount = (item.quantity || 0) * (item.unitRate || 0);
          if (item.jobCode) {
            if (item.jobCode.consumable) {
              consumableCharge += amount;
            } else {
              labourCharge += amount;
            }
          } else {
            partsCharge += amount;
          }
        });
      });

      const totalVehicles = uniqueVehicles.size || 1;
      const result = {
        labourCharge,
        labourPerVehicle: (labourCharge / totalVehicles).toFixed(2),
        parts: partsCharge,
        partsPerSold: (partsCharge / totalVehicles).toFixed(2),
        consumableCharge,
        consumablePerVehicle: (consumableCharge / totalVehicles).toFixed(2),
        mechanicCount: await prisma.user.count({ where: { status: true, EmployeeProfile_User_profileToEmployeeProfile: { department: { role: { contains: "Mechanic", mode: 'insensitive' } } } } })
      };

      return res.json({ code: 200, response: result });
    } catch (err) {
      logger.error("Part charges report error:", err);
      return res.status(500).json({ code: 500, msg: "Something went wrong.." });
    }
  };

  getDashboardData = async (req, res) => {
    try {
      const branchIds = normalizeBranchIds(req.body.branch, req.user?.branch);
      
      const [quotationCount, bookingCount, jobOrderCount] = await Promise.all([
        prisma.quotation.count({ where: { branchId: { in: branchIds } } }),
        prisma.booking.count({ where: { branchId: { in: branchIds } } }),
        prisma.jobOrder.count({ where: { branchId: { in: branchIds } } })
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

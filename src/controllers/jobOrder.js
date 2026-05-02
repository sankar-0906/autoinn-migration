import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

/**
 * Controller for Job Order operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class JobOrderController {
  // Shared include object for JobOrder
  fragment = {
    vehicle: {
      include: {
        manufacturer: true, // Lowercase in Vehicle model
        vehicleMaster: {
          include: { Manufacturer: true } // Uppercase in VehicleMaster model
        },
        color: true
      }
    },
    customer: { include: { CustomerPhone: true } }, // Fixed nesting: JobOrder.customer is already the Customer model
    branch: { include: { manufacturer: true } }, // Lowercase in Branch model
    mechanic: { 
      include: { 
        EmployeeProfile_User_profileToEmployeeProfile: { 
          include: { department: true } 
        } 
      } 
    }
  };

  createJobOrder = async (req, res) => {
    try {
      const data = req.body;
      const created = await prisma.jobOrder.create({
        data: {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        include: this.fragment
      });

      return res.json({
        code: 200,
        msg: "JobOrder created",
        data: created
      });
    } catch (err) {
      logger.error("Create job order error:", err);
      console.error("Create JobOrder Error Stack:", err.stack);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const jobOrder = await prisma.jobOrder.findUnique({
        where: { id },
        include: this.fragment
      });

      if (jobOrder) {
        return res.json({
          code: 200,
          response: { data: jobOrder }
        });
      }
      return res.status(404).json({ code: 404, msg: "Not found" });
    } catch (err) {
      logger.error("Get one job order error:", err);
      console.error("GetOne JobOrder Error Stack:", err.stack);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString, status } = req.body;
      const branchIds = req.user?.branch || [];
      const skip = (page - 1) * size;
      const inputValue = searchString || "";

      let statusFilter = {};
      if (status === "PENDING") {
        statusFilter = { jobStatus: { in: ["Vehicle Received", "Estimation"] } };
      } else if (status === "IN PROGRESS") {
        statusFilter = { jobStatus: { in: ["Mechanic Allocated", "Spares Ordered", "Work In Progress", "Washing", "Final Inspection", "Material Issued"] } };
      } else if (status === "COMPLETED") {
        statusFilter = { jobStatus: { in: ["Gate Pass", "Payment Received", "Invoice", "Proforma Invoice", "PAID"] } };
      }

      const where = {
        branchId: { in: Array.isArray(branchIds) ? branchIds : [branchIds] },
        ...statusFilter,
        OR: [
          { jobNo: { contains: inputValue, mode: 'insensitive' } },
          { serviceType: { contains: inputValue, mode: 'insensitive' } },
          { vehicle: { registerNo: { contains: inputValue, mode: 'insensitive' } } },
          { customer: { name: { contains: inputValue, mode: 'insensitive' } } }
        ]
      };

      const [jobOrders, count] = await Promise.all([
        prisma.jobOrder.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.fragment
        }),
        prisma.jobOrder.count({ where })
      ]);

      return res.json({
        code: 200,
        response: { count, jobOrder: jobOrders }
      });
    } catch (err) {
      logger.error("Get job order page error:", err);
      console.error("GetPage JobOrder Error Stack:", err.stack);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  setStatus = async (req, res) => {
    try {
      const { id, type } = req.body;
      const statusMap = {
        "Estimate": "Estimation",
        "Estimation Approved": "Estimation Approved",
        "Material": "Material Issued",
        "Work In Progress": "Work In Progress",
        "Washing": "Washing",
        "Proforma Invoice": "Proforma Invoice",
        "Final Inspection": "Final Inspection"
      };

      const updated = await prisma.jobOrder.update({
        where: { id },
        data: { jobStatus: statusMap[type] || type },
        include: this.fragment
      });

      return res.json({
        code: 200,
        msg: "Status updated",
        data: updated
      });
    } catch (err) {
      logger.error("Set job order status error:", err);
      console.error("SetStatus JobOrder Error Stack:", err.stack);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getDashboardData = async (req, res) => {
    try {
      const { timeline, from, to, employee, current } = req.body;
      const branchIds = req.user?.branch || [];
      const branchArr = Array.isArray(branchIds) ? branchIds : [branchIds];

      const moment = (await import('moment')).default;
      let fromDate, toDate;

      switch (timeline) {
        case "today":
          fromDate = moment().startOf("day").toDate();
          toDate = moment().endOf("day").toDate();
          break;
        case "week":
          fromDate = moment().startOf("week").toDate();
          toDate = moment().endOf("week").toDate();
          break;
        case "month":
          fromDate = moment().startOf("month").toDate();
          toDate = moment().endOf("month").toDate();
          break;
        case "date":
          fromDate = moment(from, "DD-MM-YYYY").startOf("day").toDate();
          toDate = moment(to, "DD-MM-YYYY").endOf("day").toDate();
          break;
        default:
          fromDate = moment().startOf("day").toDate();
          toDate = moment().endOf("day").toDate();
      }

      const whereBase = {
        branchId: { in: branchArr },
        createdAt: { gte: fromDate, lte: toDate }
      };

      // Fix for possible IN (NULL) error
      let empFilter = employee || current;
      if (empFilter) {
        const empArr = (Array.isArray(empFilter) ? empFilter : [empFilter]).filter(e => e !== null);
        if (empArr.length > 0) {
          whereBase.mechanicId = { in: empArr };
        }
      }

      // Query core data
      const [
        allJobs,
        saleInvoices,
        upComingServicesRaw,
        missedServicesRaw
      ] = await Promise.all([
        prisma.jobOrder.findMany({
          where: whereBase,
          include: this.fragment
        }),
        prisma.saleSpareInvoice.findMany({
          where: {
            branchId: { in: branchArr },
            invoiceDate: { gte: fromDate, lte: toDate }
          },
          include: {
            SaleSpareInvoiceItem: { include: { jobCode: true } },
            jobOrder: { include: { mechanic: { include: { EmployeeProfile_User_profileToEmployeeProfile: { include: { department: true } } } } } }
          }
        }),
        prisma.vehicle.findMany({
          where: {
            services: {
              some: {
                serviceDate: { gte: new Date(), lte: toDate }
              }
            }
          },
          include: { services: true }
        }),
        prisma.vehicle.findMany({
          where: {
            services: {
              some: {
                serviceDate: { lt: moment().startOf("day").toDate(), gte: fromDate }
              }
            }
          }
        })
      ]);

      // Calculate status counts
      const counts = {
        totalJobsCount: allJobs.length,
        vehicleReceivedCount: allJobs.filter(j => j.jobStatus === "Vehicle Received").length,
        EstimationCount: allJobs.filter(j => j.jobStatus?.includes("Estimation")).length,
        MechanicAllocationCount: allJobs.filter(j => j.jobStatus === "Mechanic Allocated").length,
        WIPCount: allJobs.filter(j => j.jobStatus === "Work In Progress").length,
        finalInspectionCount: allJobs.filter(j => j.jobStatus === "Final Inspection").length,
        ReadyforDeliveryCount: allJobs.filter(j => j.jobStatus === "Ready for Delivery").length,
        deliveredCount: allJobs.filter(j => j.jobStatus === "Delivered").length,
        freeServiceCount: allJobs.filter(j => j.serviceType?.includes("Free")).length,
        paidAWServiceCount: allJobs.filter(j => j.serviceType === "Paid (AW)").length,
        paidUWServiceCount: allJobs.filter(j => j.serviceType === "Paid (UW)").length,
        totalPaidServiceCount: allJobs.filter(j => ["Paid (UW)", "Paid (AW)", "Accidental", "AMC", "Minor"].includes(j.serviceType)).length,
        extendedWarrantyCount: allJobs.filter(j => j.serviceType === "Extended Warranty").length,
        amcCount: allJobs.filter(j => j.serviceType === "AMC").length,
        minorCount: allJobs.filter(j => j.serviceType === "Minor").length,
        accidentialCount: allJobs.filter(j => j.serviceType === "Accidental").length,
      };

      // Calculate Labour and Job Codes
      let labourCharge = 0;
      let jobCodes = [];
      let labourData = [];

      saleInvoices.forEach(inv => {
        if (inv.jobOrder) {
          let invLabourTotal = 0;
          inv.SaleSpareInvoiceItem.forEach(item => {
            if (item.jobCode) {
              const amount = parseFloat(item.quantity || 0) * parseFloat(item.unitRate || 0);
              invLabourTotal += amount;
              labourCharge += amount;
              jobCodes.push({
                jobOrder: inv.jobOrder.jobNo,
                jobCode: item.jobCode.code,
                count: amount,
                total: amount 
              });
            }
          });
          labourData.push({
            mechanic: inv.jobOrder.mechanic,
            total: invLabourTotal
          });
        }
      });

      // Calculate Upcoming and Missed
      const upComingJobsCount = upComingServicesRaw.length;
      let upComingFreeJobsCount = 0;
      let upComingPaidJobsCount = 0;

      upComingServicesRaw.forEach(v => {
        v.services.forEach(s => {
          const sDate = moment(s.serviceDate);
          if (sDate.isSameOrAfter(moment(), 'day') && sDate.isSameOrBefore(moment(toDate), 'day')) {
            if (s.serviceType === "FREE") upComingFreeJobsCount++;
            else if (s.serviceType === "PAID") upComingPaidJobsCount++;
          }
        });
      });

      const finalData = {
        ...counts,
        upComingJobsCount,
        upComingFreeJobsCount,
        upComingPaidJobsCount,
        missedOppurturnitiesCount: missedServicesRaw.length, 
        labourCharge,
        jobOrders: allJobs,
        labourData,
        jobCodes
      };

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Data fetched",
          data: finalData
        }
      });
    } catch (err) {
      logger.error("Get dashboard data error:", err);
      console.error("Dashboard Error Stack:", err.stack);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };
}

export default new JobOrderController();

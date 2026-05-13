import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

import IdGenerateController from "./idGenerate.js";

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
          include: { 
            manufacturer: true,
            file: true
          } // Uppercase in VehicleMaster model
        },
        color: true,
        VehicleInsurance: {
          include: { insurance: true, file: true }
        },
        MultiCustomer: {
          include: {
            customer: {
              include: { CustomerPhone: true }
            }
          }
        }
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
    },
    JobVehicleComplaint: {
      include: {
        jobCode: {
          include: {
            sac: true
          }
        }
      }
    },
    JobVehicleParts: true,
    JobVehicleImage: {
      include: {
        additionalImages: true
      }
    },
    accidentalDocuments: true,
    estimates: {
      include: {
        EstimateItem: {
          include: {
            partNumber: { include: { manufacturer: true } },
            jobCode: { include: { sac: true } },
            hsn: true,
            sac: true
          }
        },
        insurer: true,
        survivor: { include: { CustomerPhone: true } },
        branch: { include: { manufacturer: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 1
    },
    materialIssues: {
        select: { id: true }
    },
    saleSpareInvoices: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { transactions: true }
    }
  };

  /**
   * Helper to format JobOrder object to match legacy fragment structure.
   */
  formatJobOrder = (jobOrder) => {
    if (!jobOrder) return null;
    const formatted = { ...jobOrder };

    // Map VehicleMaster to 'vehicle' inside vehicle
    if (formatted.vehicle) {
      if (formatted.vehicle.vehicleMaster) {
        formatted.vehicle.vehicle = formatted.vehicle.vehicleMaster;
        delete formatted.vehicle.vehicleMaster;
      }
      if (formatted.vehicle.VehicleInsurance) {
        formatted.vehicle.insurance = formatted.vehicle.VehicleInsurance.map(vi => ({
          ...vi,
          insurance: vi.insurance,
          file: vi.file
        }));
        delete formatted.vehicle.VehicleInsurance;
      } else {
        formatted.vehicle.insurance = [];
      }
      if (formatted.vehicle.MultiCustomer) {
        formatted.vehicle.customer = formatted.vehicle.MultiCustomer.map(mc => ({
          ...mc,
          customer: mc.customer ? {
            ...mc.customer,
            contacts: mc.customer.CustomerPhone || []
          } : null
        }));
        delete formatted.vehicle.MultiCustomer;
      } else {
        formatted.vehicle.customer = [];
      }
    }

    // Map Mechanic's EmployeeProfile to 'profile'
    if (formatted.mechanic) {
      if (formatted.mechanic.EmployeeProfile_User_profileToEmployeeProfile) {
        formatted.mechanic.profile = formatted.mechanic.EmployeeProfile_User_profileToEmployeeProfile;
        delete formatted.mechanic.EmployeeProfile_User_profileToEmployeeProfile;
      } else {
        formatted.mechanic.profile = { department: {} };
      }
    }

    // Map Customer's CustomerPhone to contacts
    if (formatted.customer) {
      if (formatted.customer.CustomerPhone) {
        formatted.customer.contacts = formatted.customer.CustomerPhone;
        delete formatted.customer.CustomerPhone;
      }
    }

    if (formatted.JobVehicleComplaint) {
      formatted.complaint = formatted.JobVehicleComplaint;
      delete formatted.JobVehicleComplaint;
    } else {
      formatted.complaint = [];
    }
    if (formatted.JobVehicleParts) {
      formatted.parts = formatted.JobVehicleParts;
      delete formatted.JobVehicleParts;
    } else {
      formatted.parts = {};
    }
    if (formatted.JobVehicleImage) {
      formatted.vehicleImage = formatted.JobVehicleImage;
      delete formatted.JobVehicleImage;
    } else {
      formatted.vehicleImage = {};
    }

    // Map latest estimate to 'Estimate'
    if (formatted.estimates && formatted.estimates.length > 0) {
      const estimate = formatted.estimates[0];
      const formattedEstimate = { ...estimate };

      // Convert Decimal fields to Numbers in Estimate
      const estimateDecimals = [
        'discountPercent', 'discountRate', 'cgstAmount', 'sgstAmount', 'igstAmount', 
        'totalDiscount', 'labourCharge', 'consumableCharge', 'partCharge', 'estTotalAmount', 'adjustment'
      ];
      estimateDecimals.forEach(f => {
        if (formattedEstimate[f] !== undefined && formattedEstimate[f] !== null) {
          formattedEstimate[f] = Number(formattedEstimate[f]);
        }
      });

      // Map EstimateItem to estimateItemInvoice
      if (formattedEstimate.EstimateItem) {
        formattedEstimate.estimateItemInvoice = formattedEstimate.EstimateItem.map(item => {
          const formattedItem = { ...item };
          const itemDecimals = [
            'quantity', 'unitRate', 'igst', 'cgst', 'sgst',
            'igstAmount', 'cgstAmount', 'sgstAmount', 'discountAmount', 'discountPercent'
          ];
          itemDecimals.forEach(f => {
            if (formattedItem[f] !== undefined && formattedItem[f] !== null) {
              formattedItem[f] = Number(formattedItem[f]);
            }
          });
          return formattedItem;
        });
        delete formattedEstimate.EstimateItem;
      }
      
      formatted.Estimate = formattedEstimate;
      delete formatted.estimates;
    } else {
      formatted.Estimate = null;
      delete formatted.estimates;
    }

    // Map latest invoice total and payments to 'totalInvoice' and 'payments'
    if (formatted.saleSpareInvoices && formatted.saleSpareInvoices.length > 0) {
      const latestInvoice = formatted.saleSpareInvoices[0];
      formatted.totalInvoice = Number(latestInvoice.totalInvoice || 0);
      formatted.payments = latestInvoice.transactions || [];
    } else {
      formatted.totalInvoice = 0;
      formatted.payments = [];
    }

    return formatted;
  };

  /**
   * Robust ID extraction for connect operations.
   */
  getConnectId = (val) => {
    if (!val) return null;
    if (typeof val === 'string' && val.trim() !== "") return val;
    if (val.id && typeof val.id === 'string' && val.id.trim() !== "") return val.id;
    // Handle legacy nested structure { customer: { id: ... } }
    if (val.customer && val.customer.id) return val.customer.id;
    if (val.customer && typeof val.customer === 'string' && val.customer.trim() !== "") return val.customer;
    return null;
  };

  /**
   * Safely parses numeric inputs from frontend
   */
  parseNumeric = (val) => {
    if (val === undefined || val === null || val === "" || val === "null" || val === "undefined") return null;
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  };

  /**
   * Validates if an ID exists in the DB, with fallback to unique fields.
   */
  getValidatedId = async (model, val) => {
    const id = this.getConnectId(val);
    if (!id) return null;

    try {
      // 1. Try finding by primary key
      const record = await prisma[model].findUnique({
        where: { id }
      });
      if (record) return id;

      // 2. Fallback for specific models
      if (model === 'customer') {
        const byCid = await prisma.customer.findUnique({
          where: { customerId: id }
        });
        if (byCid) return byCid.id;
      }

      if (model === 'vehicle') {
        const byChassis = await prisma.vehicle.findUnique({
          where: { chassisNo: id }
        });
        if (byChassis) return byChassis.id;
        
        const byReg = await prisma.vehicle.findUnique({
          where: { registerNo: id }
        });
        if (byReg) return byReg.id;
      }

      // If not found, log and return null to avoid Prisma crash
      logger.warn(`Record not found in ${model} for ID/Key: ${id}`);
      return null;
    } catch (err) {
      logger.error(`Error validating ID for ${model}:`, err);
      return null;
    }
  };

  createJobOrder = async (req, res) => {
    try {
      const data = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const {
        dateTime,
        customer,
        vehicle,
        branch,
        kms,
        serviceType,
        serviceNo,
        couponNo,
        complaint,
        parts,
        fuelLevel,
        accidentalDocuments,
        customerPhone,
        front, rhs, lhs, rear, top, // vehicleImage fields
        additionalImages
      } = data;

      // Map complaint
      const complaintData = complaint && complaint.length > 0 ? {
        create: complaint.filter(c => c.complaint).map(c => ({
          complaint: c.complaint,
          jobStatus: "Vehicle Received",
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      } : undefined;

      // Map parts
      const partsData = parts ? {
        create: {
          MirrorRH: !!parts.MirrorRH,
          MirrorLH: !!parts.MirrorLH,
          Toolkit: !!parts.Toolkit,
          FirstAdKit: !!parts.FirstAdKit,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      } : undefined;

      // Map vehicleImage
      const vehicleImageData = {
        create: {
          frontView: front || null,
          rhsView: rhs || null,
          lhsView: lhs || null,
          rearView: rear || null,
          topView: top || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          additionalImages: additionalImages && additionalImages.length > 0 ? {
            create: additionalImages.map(img => ({ 
              url: typeof img === 'string' ? img : img.url,
              createdAt: new Date()
            }))
          } : undefined
        }
      };

      const branchId = this.getConnectId(branch);
      const validatedCustomerId = await this.getValidatedId('customer', customer);
      const validatedVehicleId = await this.getValidatedId('vehicle', vehicle);

      // Generate Job No
      const jobNodata = await IdGenerateController.jobOrderIdGenerate({}, { branch: branchId });
      const jobNo = jobNodata.data;

      const created = await prisma.jobOrder.create({
        data: {
          jobNo,
          dateTime: dateTime ? new Date(dateTime) : new Date(),
          kms: (kms !== undefined && kms !== null) ? parseFloat(kms) : null,
          serviceType,
          serviceNo,
          couponNo,
          fuelLevel: (fuelLevel !== undefined && fuelLevel !== null) ? parseFloat(fuelLevel) : null,
          customerPhone,
          jobStatus: "Vehicle Received",
          createdAt: new Date(),
          updatedAt: new Date(),
          customer: validatedCustomerId ? { connect: { id: validatedCustomerId } } : undefined,
          vehicle: validatedVehicleId ? { connect: { id: validatedVehicleId } } : undefined,
          branch: branchId ? { connect: { id: branchId } } : undefined,
          createdBy: this.getConnectId(user) ? { connect: { id: this.getConnectId(user) } } : undefined,
          JobVehicleComplaint: complaintData,
          JobVehicleParts: partsData,
          JobVehicleImage: vehicleImageData,
          accidentalDocuments: accidentalDocuments && accidentalDocuments.length > 0 ? {
            create: accidentalDocuments.map(doc => ({ 
              url: typeof doc === 'string' ? doc : doc.url 
            }))
          } : undefined
        },
        include: this.fragment
      });

      // Increment ID counter
      await IdGenerateController.incrementId("JOBORDER", branchId);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "JobOrder created",
          data: this.formatJobOrder(created)
        }
      });
    } catch (err) {
      logger.error("Create job order error:", err);
      console.error("Create JobOrder Error Stack:", err.stack);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  updateJobOrder = async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const user = req.user?.id;

      const {
        jobNo,
        dateTime,
        customer,
        vehicle,
        kms,
        serviceType,
        serviceNo,
        couponNo,
        complaint,
        vehicleImage,
        parts,
        fuelLevel,
        branch,
        customerPhone,
        accidentalDocuments
      } = data;

      const updateData = {
        updatedAt: new Date()
      };

      if (jobNo) updateData.jobNo = jobNo;
      if (dateTime) updateData.dateTime = new Date(dateTime);
      if (kms !== undefined) updateData.kms = this.parseNumeric(kms);
      if (serviceType) updateData.serviceType = serviceType;
      if (serviceNo) updateData.serviceNo = serviceNo;
      if (couponNo) updateData.couponNo = couponNo;
      if (customerPhone) updateData.customerPhone = customerPhone;
      if (fuelLevel !== undefined) updateData.fuelLevel = this.parseNumeric(fuelLevel);
      const extractedCustomerId = await this.getValidatedId('customer', customer);
      if (extractedCustomerId) {
        updateData.customer = { connect: { id: extractedCustomerId } };
      }

      const extractedVehicleId = await this.getValidatedId('vehicle', vehicle);
      if (extractedVehicleId) {
        updateData.vehicle = { connect: { id: extractedVehicleId } };
      }

      const extractedBranchId = this.getConnectId(branch);
      if (extractedBranchId) {
        updateData.branch = { connect: { id: extractedBranchId } };
      }

      // Handle complaints
      if (complaint && Array.isArray(complaint)) {
        updateData.JobVehicleComplaint = {
          set: [], // Disconnect existing
          create: complaint.filter(c => c.complaint).map(c => ({
            complaint: c.complaint,
            jobStatus: c.jobStatus || "Vehicle Received",
            createdAt: new Date(),
            updatedAt: new Date()
          }))
        };
      }

      // Handle parts
      if (parts) {
        updateData.JobVehicleParts = {
          upsert: {
            create: {
              MirrorRH: !!parts.MirrorRH,
              MirrorLH: !!parts.MirrorLH,
              Toolkit: !!parts.Toolkit,
              FirstAdKit: !!parts.FirstAdKit,
              createdAt: new Date(),
              updatedAt: new Date()
            },
            update: {
              MirrorRH: !!parts.MirrorRH,
              MirrorLH: !!parts.MirrorLH,
              Toolkit: !!parts.Toolkit,
              FirstAdKit: !!parts.FirstAdKit,
              updatedAt: new Date()
            }
          }
        };
      }

      // Handle vehicleImage
      if (vehicleImage) {
        const additionalImages = vehicleImage.additionalImages || [];
        updateData.JobVehicleImage = {
          upsert: {
            create: {
              frontView: vehicleImage.frontView || null,
              rhsView: vehicleImage.rhsView || null,
              lhsView: vehicleImage.lhsView || null,
              rearView: vehicleImage.rearView || null,
              topView: vehicleImage.topView || null,
              createdAt: new Date(),
              updatedAt: new Date(),
              additionalImages: additionalImages.length > 0 ? {
                create: additionalImages.map(img => ({ 
                  url: typeof img === 'string' ? img : img.url,
                  createdAt: new Date()
                }))
              } : undefined
            },
            update: {
              frontView: vehicleImage.frontView || null,
              rhsView: vehicleImage.rhsView || null,
              lhsView: vehicleImage.lhsView || null,
              rearView: vehicleImage.rearView || null,
              topView: vehicleImage.topView || null,
              updatedAt: new Date(),
              additionalImages: {
                deleteMany: {},
                create: additionalImages.map(img => ({ 
                  url: typeof img === 'string' ? img : img.url,
                  createdAt: new Date()
                }))
              }
            }
          }
        };
      }

      // Handle accidentalDocuments
      if (accidentalDocuments && Array.isArray(accidentalDocuments)) {
        updateData.accidentalDocuments = {
          deleteMany: {},
          create: accidentalDocuments.map(doc => ({ 
            url: typeof doc === 'string' ? doc : doc.url 
          }))
        };
      }

      console.log(`DEBUG: Updating JobOrder ${id} with payload:`, JSON.stringify(updateData, null, 2));

      const updated = await prisma.jobOrder.update({
        where: { id },
        data: updateData,
        include: this.fragment
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "JobOrder updated",
          data: this.formatJobOrder(updated)
        }
      });
    } catch (err) {
      logger.error("Update job order error:", err);
      console.error("Update JobOrder Error Stack:", err.stack);
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
        // Fetch related payments manually
        const payments = await prisma.payment.findMany({
          where: {
            moduleId: id,
            module: "JobOrder"
          }
        });

        const formatted = this.formatJobOrder(jobOrder);
        formatted.payments = payments.map(p => ({
          ...p,
          billAmount: Number(p.billAmount || 0),
          collectedAmount: Number(p.collectedAmount || 0)
        }));

        const slipCount = jobOrder.materialIssues ? jobOrder.materialIssues.length : 0;
        delete formatted.materialIssues; // Cleanup from data object

        return res.json({
          code: 200,
          response: { 
             code: 200,
             msg: "JobOrder fetched",
             data: formatted,
             currentSlipNumber: slipCount
          }
        });
      }
      return res.status(404).json({ code: 404, msg: "Not found" });
    } catch (err) {
      logger.error("Get one job order error:", err);
      console.error("GetOne JobOrder Error Stack:", err.stack);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  /**
   * Internal helper for fetching paginated job orders with status filtering.
   */
  getJobOrdersInternal = async (data, branchIds) => {
    const { page, size, searchString, status } = data;
    const skip = (page - 1) * size;
    const take = size;
    const inputValue = searchString || "";

    let statusFilter = {};
    if (status === "PENDING") {
      statusFilter = { 
        OR: [
          { jobStatus: "Vehicle Received" },
          { jobStatus: { contains: "Estimation", mode: 'insensitive' } }
        ]
      };
    } else if (status === "IN PROGRESS") {
      statusFilter = { 
        jobStatus: { 
          in: ["Mechanic Allocated", "Spares Ordered", "Work In Progress", "Washing", "Final Inspection", "Material Issued"] 
        } 
      };
    } else if (status === "COMPLETED") {
      statusFilter = { jobStatus: { in: ["Gate Pass", "Payment Received", "Invoice", "Proforma Invoice", "PAID"] } };
    } else if (status) {
      statusFilter = { jobStatus: status };
    }

    const where = {
      AND: [
        { branchId: { in: Array.isArray(branchIds) ? branchIds : [branchIds] } },
        statusFilter,
        {
          OR: [
            { jobNo: { contains: inputValue, mode: 'insensitive' } },
            { serviceType: { contains: inputValue, mode: 'insensitive' } },
            { vehicle: { registerNo: { contains: inputValue, mode: 'insensitive' } } },
            { vehicle: { chassisNo: { contains: inputValue, mode: 'insensitive' } } },
            { vehicle: { engineNo: { contains: inputValue, mode: 'insensitive' } } },
            { customer: { name: { contains: inputValue, mode: 'insensitive' } } },
            { 
              customer: { 
                CustomerPhone: { 
                  some: { phone: { contains: inputValue, mode: 'insensitive' } } 
                } 
              } 
            }
          ]
        }
      ]
    };

    const [jobOrders, count] = await Promise.all([
      prisma.jobOrder.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: this.fragment
      }),
      prisma.jobOrder.count({ where })
    ]);

    // Fetch payments for these job orders manually
    const jobOrderIds = jobOrders.map(j => j.id);
    const allPayments = await prisma.payment.findMany({
      where: {
        moduleId: { in: jobOrderIds },
        module: "JobOrder"
      }
    });

    const formattedData = jobOrders.map(jo => {
      const jobPayments = allPayments.filter(p => p.moduleId === jo.id);
      const formatted = this.formatJobOrder(jo);
      formatted.payments = jobPayments.map(p => ({
        ...p,
        billAmount: Number(p.billAmount || 0),
        collectedAmount: Number(p.collectedAmount || 0)
      }));
      return formatted;
    });

    return { count, jobOrder: formattedData };
  };

  getPage = async (req, res) => {
    try {
      const branchIds = req.user?.branch || [];
      const data = await this.getJobOrdersInternal(req.body, branchIds);

      return res.json({
        code: 200,
        response: { 
          code: 200,
          msg: "JobOrders fetched",
          data
        }
      });
    } catch (err) {
      logger.error("Get job order page error:", err);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  getPendingInProgress = async (req, res) => {
    try {
      const { body } = req;
      let branchIds = body.branch || req.user?.branch || [];
      if (typeof branchIds === 'string') branchIds = [branchIds];
      
      const [pendingResult, inProgressResult] = await Promise.all([
        this.getJobOrdersInternal({ ...body, status: "PENDING" }, branchIds),
        this.getJobOrdersInternal({ ...body, status: "IN PROGRESS" }, branchIds)
      ]);

      const mergedJobOrders = [
        ...(pendingResult.jobOrder || []),
        ...(inProgressResult.jobOrder || [])
      ];

      const totalCount = (pendingResult.count || 0) + (inProgressResult.count || 0);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Pending & In Progress Job Orders fetched",
          data: { count: totalCount, jobOrder: mergedJobOrders }
        }
      });
    } catch (err) {
      logger.error("Get pending/in-progress job orders error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
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
        response: {
          code: 200,
          msg: "Status updated",
          data: this.formatJobOrder(updated)
        }
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
          data: {
             ...finalData,
             jobOrders: allJobs.map(j => this.formatJobOrder(j))
          }
        }
      });
    } catch (err) {
      logger.error("Get dashboard data error:", err);
      console.error("Dashboard Error Stack:", err.stack);
      return res.json({ code: 500, msg: "An error occured" });
    }
  };

  historyVehicleJobs = async (req, res) => {
    try {
      const { id } = req.params; // Vehicle ID
      const [jobOrders, invoices] = await Promise.all([
        prisma.jobOrder.findMany({
          where: { vehicleId: id },
          orderBy: { createdAt: 'desc' },
          include: this.fragment
        }),
        prisma.saleSpareInvoice.findMany({
          where: { jobOrder: { vehicleId: id } },
          include: {
            SaleSpareInvoiceItem: { 
              include: { 
                jobCode: true,
                partNumber: { include: { manufacturer: true } }
              } 
            },
            jobOrder: true
          }
        })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Job history fetched",
          data: { 
            History: jobOrders.map(j => this.formatJobOrder(j)), 
            Invoice: invoices.map(inv => ({
              ...inv,
              saleItemInvoice: inv.SaleSpareInvoiceItem,
              jobOrder: this.formatJobOrder(inv.jobOrder)
            })) 
          }
        }
      });
    } catch (err) {
      logger.error("History vehicle jobs error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  vehicleJobOrder = async (req, res) => {
    try {
      const { registerNo, chassisNo, engineNo } = req.body;
      const jobOrders = await prisma.jobOrder.findMany({
        where: {
          vehicle: {
            OR: [
              { registerNo },
              { chassisNo },
              { engineNo }
            ]
          }
        },
        orderBy: { createdAt: 'desc' },
        include: this.fragment
      });
      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Job orders fetched",
          data: jobOrders.map(j => this.formatJobOrder(j))
        }
      });
    } catch (err) {
      logger.error("Vehicle job order search error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getJobNo = async (req, res) => {
    try {
      const { page, size, status } = req.body;
      const branchIds = req.user?.branch || [];
      const branchArr = Array.isArray(branchIds) ? branchIds : [branchIds];
      const skip = (parseInt(page) - 1) * parseInt(size || 10);
      const take = parseInt(size || 10);

      let where = {
        branchId: { in: branchArr }
      };

      if (status && status !== "ALL") {
        where.jobStatus = "Vehicle Received";
        where.NOT = { jobStatus: "Work In Progress" };
      }

      const jobOrders = await prisma.jobOrder.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: this.fragment
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "JobNo fetched",
          data: jobOrders.map(j => this.formatJobOrder(j))
        }
      });
    } catch (err) {
      logger.error("Get job no list error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  historyJobOrder = async (req, res) => {
    try {
      const { vehicle, dateTime } = req.body;
      const branchIds = req.user?.branch || [];
      const branchArr = Array.isArray(branchIds) ? branchIds : [branchIds];
      
      const [jobOrders, invoices] = await Promise.all([
        prisma.jobOrder.findMany({
          where: {
            vehicleId: vehicle,
            branchId: { in: branchArr },
            createdAt: { lt: new Date(dateTime) }
          },
          orderBy: { createdAt: 'desc' },
          include: this.fragment
        }),
        prisma.saleSpareInvoice.findMany({
          where: {
            jobOrder: {
              vehicleId: vehicle,
              createdAt: { lte: new Date(dateTime) }
            },
            branchId: { in: branchArr }
          },
          orderBy: { createdAt: 'desc' },
          include: {
            SaleSpareInvoiceItem: {
              include: {
                jobCode: true,
                partNumber: { include: { manufacturer: true } }
              }
            },
            jobOrder: true
          }
        })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Job History fetched",
          data: {
            History: jobOrders.map(j => this.formatJobOrder(j)),
            Invoice: invoices.map(inv => ({
              ...inv,
              saleItemInvoice: inv.SaleSpareInvoiceItem,
              jobOrder: this.formatJobOrder(inv.jobOrder)
            }))
          }
        }
      });
    } catch (err) {
      logger.error("History job order error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  deleteJobOrder = async (req, res) => {
    try {
      const { id } = req.params;
      
      // Before deleting job order, handle dependencies
      // AccidentalDocuments and JobOrderLogs typically belong exclusively to one job order
      await prisma.accidentalDocument.deleteMany({ where: { jobOrderId: id } });
      
      // JobOrderLog might be linked via jobOrder field or JobOrder relation
      await prisma.jobOrderLog.deleteMany({ where: { jobOrder: id } });
      
      await prisma.jobOrder.delete({
        where: { id }
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "JobOrder deleted permanently."
        }
      });
    } catch (err) {
      logger.error("Delete job order error:", err);
      // If it's a constraint error, let's give a more helpful message
      if (err.code === 'P2003') {
        return res.json({ 
          code: 500, 
          msg: "Cannot delete Job Order because it has linked records (Invoices/Estimates)" 
        });
      }
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  updateMechanic = async (req, res) => {
    try {
      const { id } = req.params;
      const { mechanic } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const updated = await prisma.jobOrder.update({
        where: { id },
        data: {
          jobStatus: "Mechanic Allocated",
          mechanic: mechanic ? { connect: { id: mechanic } } : { disconnect: true }
        },
        include: this.fragment
      });

      if (updated) {
        // Create log
        await prisma.jobOrderLog.create({
          data: {
            event: "Mechanic Allocated",
            JobOrder: { connect: { id: updated.id } },
            data: updated.mechanicId || null,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "JobOrder updated",
            data: updated
          }
        });
      }

      return res.json({ 
        code: 400, 
        response: { code: 400, message: "Data is not Found" } 
      });
    } catch (err) {
      logger.error("Update mechanic error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getJoborder = async (req, res) => {
    try {
      const { mobileNo } = req.body;
      const customers = await prisma.customer.findMany({
        where: {
          CustomerPhone: {
            some: { phone: mobileNo }
          }
        },
        include: {
          Vehicle: {
            include: {
              color: true,
              vehicleMaster: true
            }
          }
        }
      });

      if (customers.length > 0) {
        const customer = customers[0];
        const formatted = {
          id: customer.id,
          purchasedVehicle: customer.Vehicle.map(v => ({
            id: v.id,
            registerNo: v.registerNo,
            chassisNo: v.chassisNo,
            batteryNo: v.batteryNo,
            engineNo: v.engineNo,
            color: v.color,
            vehicle: v.vehicleMaster ? {
              id: v.vehicleMaster.id,
              modelName: v.vehicleMaster.modelName,
              modelCode: v.vehicleMaster.modelCode
            } : null,
            dateOfSale: v.dateOfSale,
            serviceCouponNumber: v.serviceCouponNumber
          }))
        };

        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "Getting Job Order",
            data: formatted
          }
        });
      }
      return res.json({ 
        code: 200, 
        response: { code: 404, message: "Customer not found" } 
      });
    } catch (err) {
      logger.error("Get job order by mobile error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };
}

export default new JobOrderController();

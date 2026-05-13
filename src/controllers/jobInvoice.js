import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

import IdGenerateController from "./idGenerate.js";

/**
 * Controller for Job Invoice operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class JobInvoiceController {
  // Shared include object for JobInvoice
  // Comprehensive include for SaleSpareInvoice (matches legacy fragment)
  saleSpareInclude = {
    partyName: {
      include: {
        address: { include: { district: true, state: true, country: true } },
        CustomerPhone: true,
        Vehicle: {
          include: {
            vehicleMaster: { include: { manufacturer: true } },
            color: true
          }
        },
        booking: true,
        quotation: {
          include: {
            QuotationVehicle: {
              include: {
                vehicleDetail: { include: { price: true, manufacturer: true } },
                InsuranceType: true,
                OptionalType: true
              }
            }
          }
        }
      }
    },
    branch: {
      include: {
        company: true,
        manufacturer: true,
        address: { include: { district: true, state: true, country: true } },
        bankDetails: true,
        personInCharge: { include: { EmployeeProfile_User_profileToEmployeeProfile: { include: { department: true } } } }
      }
    },
    jobOrder: {
      include: {
        vehicle: {
          include: {
            vehicleMaster: { include: { manufacturer: true } },
            color: true,
            Customer: { include: { CustomerPhone: true } }
          }
        },
        customer: {
          include: {
            address: { include: { district: true, state: true, country: true } },
            CustomerPhone: true
          }
        },
        branch: {
          include: {
            company: true,
            manufacturer: true,
            address: { include: { district: true, state: true, country: true } },
            bankDetails: true,
            personInCharge: { include: { EmployeeProfile_User_profileToEmployeeProfile: { include: { department: true } } } }
          }
        },
        mechanic: {
          include: {
            EmployeeProfile_User_profileToEmployeeProfile: {
              include: { department: { include: { RoleAccess: { include: { access: true } } } } }
            }
          }
        },
        JobVehicleComplaint: { include: { jobCode: { include: { sac: true } } } },
        JobVehicleImage: true,
        JobVehicleParts: true
      }
    },
    SaleSpareInvoiceItem: {
      include: {
        partNumber: { include: { hsn: true, manufacturer: true } },
        hsn: true,
        sac: true,
        branch: {
          include: {
            company: true,
            manufacturer: true,
            address: { include: { district: true, state: true, country: true } },
            bankDetails: true,
            personInCharge: { include: { EmployeeProfile_User_profileToEmployeeProfile: { include: { department: true } } } }
          }
        }
      }
    }
  };

  // Legacy include for JobInvoice model
  invoiceInclude = {
    JobOrder: {
      include: {
        customer: true,
        vehicle: { include: { vehicleMaster: true } },
        branch: true
      }
    },
    parts: {
      include: {
        MaterialPartsIssue: {
          include: {
            part: true
          }
        }
      }
    }
  };

  /**
   * Helper to format SaleSpareInvoice object to match legacy structure.
   */
  formatSaleSpareInvoice = (invoice) => {
    if (!invoice) return null;
    const formatted = { ...invoice };

    // Rename fields for legacy parity
    if (formatted.partyName) {
      formatted.partyName.contacts = formatted.partyName.CustomerPhone || [];
      formatted.partyName.purchasedVehicle = (formatted.partyName.Vehicle || []).map(v => ({
        ...v,
        vehicle: v.vehicleMaster ? {
          ...v.vehicleMaster,
          manufacturer: v.vehicleMaster.manufacturer
        } : null
      }));
      delete formatted.partyName.CustomerPhone;
      delete formatted.partyName.Vehicle;

      if (formatted.partyName.quotation && Array.isArray(formatted.partyName.quotation)) {
          formatted.partyName.quotation = formatted.partyName.quotation.map(q => ({
              ...q,
              vehicle: (q.QuotationVehicle || []).map(qv => ({
                  ...qv,
                  vehicleDetail: qv.vehicleDetail ? {
                      ...qv.vehicleDetail,
                      price: qv.vehicleDetail.price
                  } : null
              }))
          }));
      }
    }

    if (formatted.jobOrder) {
        if (formatted.jobOrder.vehicle) {
            formatted.jobOrder.vehicle.vehicle = formatted.jobOrder.vehicle.vehicleMaster;
            delete formatted.jobOrder.vehicle.vehicleMaster;
        }
        if (formatted.jobOrder.mechanic) {
            formatted.jobOrder.mechanic.profile = formatted.jobOrder.mechanic.EmployeeProfile_User_profileToEmployeeProfile;
            delete formatted.jobOrder.mechanic.EmployeeProfile_User_profileToEmployeeProfile;
        }
        if (formatted.jobOrder.JobVehicleImage) {
            formatted.jobOrder.vehicleImage = formatted.jobOrder.JobVehicleImage;
            delete formatted.jobOrder.JobVehicleImage;
        }
        if (formatted.jobOrder.JobVehicleParts) {
            formatted.jobOrder.parts = formatted.jobOrder.JobVehicleParts;
            delete formatted.jobOrder.JobVehicleParts;
        }
        if (formatted.jobOrder.JobVehicleComplaint) {
            formatted.jobOrder.complaint = formatted.jobOrder.JobVehicleComplaint;
            delete formatted.jobOrder.JobVehicleComplaint;
        }
    }

    if (formatted.branch && formatted.branch.personInCharge && Array.isArray(formatted.branch.personInCharge)) {
        formatted.branch.personInCharge = formatted.branch.personInCharge.map(pic => ({
            ...pic,
            profile: pic.EmployeeProfile_User_profileToEmployeeProfile
        }));
    }

    if (formatted.SaleSpareInvoiceItem) {
      formatted.saleItemInvoice = formatted.SaleSpareInvoiceItem.map(item => ({
        ...item,
        partNumber: item.partNumber ? {
            ...item.partNumber,
            hsn: item.partNumber.hsn,
            manufacturer: item.partNumber.manufacturer
        } : null
      }));
      delete formatted.SaleSpareInvoiceItem;
    }

    // Numeric conversion
    ['totalInvoice', 'cgst', 'sgst', 'igst', 'totalDiscount', 'adjustment', 'discountPercent', 'discountRate', 'tcs', 'labourCharge', 'partsCharge', 'consumableCharge'].forEach(field => {
      if (formatted[field] !== undefined && formatted[field] !== null) {
        formatted[field] = Number(formatted[field]);
      }
    });

    return formatted;
  };

  /**
   * Helper to format JobInvoice object to match legacy structure.
   */
  formatInvoice = (invoice) => {
    if (!invoice) return null;
    const formatted = { ...invoice };
    
    // Convert Decimal fields to Numbers
    ['total', 'roundOff'].forEach(field => {
      if (formatted[field] !== undefined && formatted[field] !== null) {
        formatted[field] = Number(formatted[field]);
      }
    });

    return formatted;
  };

  createJobInvoice = async (req, res) => {
    try {
      const {
        invoiceNumber, invoiceDate, jobOrder, itemRate,
        discountType, discountPercent, discountRate, tcs,
        cgst, sgst, igst, totalDiscount, adjustment, totalInvoice,
        saleSpareInvoice, saleJobInvoice
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.jobInvoice.create({
        data: {
          invoiceNo: invoiceNumber,
          createdAt: new Date(),
          updatedAt: new Date(),
          JobOrder: jobOrder ? { connect: { id: jobOrder } } : undefined,
          User: user ? { connect: { id: user } } : undefined,
        },
        include: this.invoiceInclude
      });

      // Increment ID counter
      let branchId = null;
      if (jobOrder) {
          const jo = await prisma.jobOrder.findUnique({ where: { id: jobOrder }, select: { branchId: true } });
          branchId = jo?.branchId;
      }
      await IdGenerateController.incrementId("JOBINVOICE", branchId);

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Job invoice created successfully",
          data: this.formatInvoice(created)
        }
      });
    } catch (err) {
      logger.error("Create job invoice error:", err);
      return res.json({ code: 500, response: { code: 500, message: "An error occured", data: err } });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await prisma.jobInvoice.findUnique({
        where: { id },
        include: this.invoiceInclude
      });

      if (invoice) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "job invoice fetched",
            data: this.formatInvoice(invoice)
          }
        });
      }
      return res.json({
        code: 404,
        response: {
          code: 404,
          message: "Not found",
          data: null
        }
      });
    } catch (err) {
      logger.error("Get one job invoice error:", err);
      return res.json({ code: 500, response: { code: 500, message: "Server error" } });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString } = req.body;
      const skip = (page - 1) * size;
      const inputValue = searchString || "";

      const where = {
        OR: [
          { invoiceNo: { contains: inputValue, mode: 'insensitive' } },
          { JobOrder: { jobNo: { contains: inputValue, mode: 'insensitive' } } },
          { JobOrder: { customerPhone: { contains: inputValue, mode: 'insensitive' } } }
        ]
      };

      const [invoices, count] = await Promise.all([
        prisma.jobInvoice.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.invoiceInclude
        }),
        prisma.jobInvoice.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "JobInvoices fetched",
          data: { 
            count, 
            jobInvoice: invoices.map(inv => this.formatInvoice(inv)) 
          }
        }
      });
    } catch (err) {
      logger.error("Get job invoice page error:", err);
      return res.json({ code: 500, response: { code: 500, message: "an error occurred" } });
    }
  };

  getJob = async (req, res) => {
    try {
      const { id } = req.params;
      
      // Legacy behavior: fetch from SaleSpareInvoice for job-related invoices
      const queryOptions = {
        where: {
          jobOrder: { id: id }
        },
        orderBy: { createdAt: 'asc' }
      };

      if (Object.keys(this.saleSpareInclude).length > 0) {
        queryOptions.include = this.saleSpareInclude;
      }

      const invoices = await prisma.saleSpareInvoice.findMany(queryOptions);

      if (invoices && invoices.length > 0) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "purchase share invoice fetched", // Match legacy typo-message
            data: this.formatSaleSpareInvoice(invoices[invoices.length - 1])
          }
        });
      }

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "No invoice found for this job order",
          data: null
        }
      });
    } catch (err) {
      logger.error(`Get job invoice by job ID error: ${err.message}`);
      if (err.stack) logger.error(err.stack);
      return res.json({ code: 500, response: { code: 500, message: "Server error", error: err.message } });
    }
  };

  checkExistence = async (req, res) => {
    try {
      const { id: jobOrderId } = req.params;

      // 1. Check for existing Sale Spare Invoice
      const existingInvoices = await prisma.saleSpareInvoice.findMany({
        where: { jobOrderId: jobOrderId },
        include: this.saleSpareInclude
      });

      if (existingInvoices && existingInvoices.length > 0) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "Job Invoice already exists for this Job Order - Cannot create new Job Invoice",
            data: existingInvoices.map(inv => this.formatSaleSpareInvoice(inv))
          }
        });
      }

      // 2. Fetch JobOrder details including mechanic and ramp
      const jobOrder = await prisma.jobOrder.findUnique({
        where: { id: jobOrderId },
        include: {
          mechanic: {
            include: {
              EmployeeProfile_User_profileToEmployeeProfile: {
                select: { employeeName: true }
              }
            }
          },
          ramp: {
            include: {
              Branch: { select: { id: true, name: true } },
              User: {
                include: {
                  EmployeeProfile_User_profileToEmployeeProfile: {
                    select: { employeeName: true }
                  }
                }
              }
            }
          }
        }
      });

      // 3. Check if there are any Material Issues associated with this JobOrder
      const materialIssues = await prisma.materialIssue.findMany({
        where: { jobOrderId: jobOrderId }
      });

      // 4. Priority: Job Order assigned to a ramp
      if (jobOrder && jobOrder.ramp) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "Job Order assigned to ramp - Remove from ramp to create new Job Invoice",
            data: jobOrder.ramp
          }
        });
      }

      // 5. Priority: Mechanic not allocated (only if no MaterialIssue exists)
      if ((!materialIssues || materialIssues.length === 0) && (jobOrder && !jobOrder.mechanic)) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "Mechanic is not allocated to this Job Order - Allocate mechanic to create invoice",
            data: jobOrder
          }
        });
      }

      // 6. All clear — safe to create invoice
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "No Job Invoice exists and Job Order is ready - Create new Job Invoice",
          data: null
        }
      });

    } catch (err) {
      logger.error("Check existence job invoice error:", err);
      return res.json({
        code: 500,
        response: {
          code: 500,
          message: "Error checking Sale Spare Invoice existence or ramp assignment",
          data: err.message
        }
      });
    }
  };
}

export default new JobInvoiceController();

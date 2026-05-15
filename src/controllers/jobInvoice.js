import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";

import IdGenerateController from "./idGenerate.js";

/**
 * Controller for Job Invoice operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class JobInvoiceController {
  // Shared include object for SaleSpareInvoice (Matches legacy fragments)
  saleSpareInclude = {
    partyName: {
      include: {
        address: { include: { district: true, state: true, country: true } },
        CustomerPhone: true,
        refferedBy: { include: { CustomerPhone: true } },
        Vehicle: {
          include: {
            vehicleMaster: { include: { manufacturer: true, price: true } },
            color: true
          }
        },
        booking: {
          include: {
            vehicle: { include: { manufacturer: true, price: true } },
            color: true
          }
        },
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
            vehicleMaster: { include: { manufacturer: true, file: true } },
            color: true,
            Customer: { include: { CustomerPhone: true } },
            VehicleInsurance: { include: { insurance: true, file: true } }
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
        JobVehicleComplaint: { 
          include: { 
            jobCode: { 
              include: { 
                sac: true,
                JobCodePrice: { include: { vehicle: true } }
              } 
            } 
          } 
        },
        JobVehicleImage: { include: { additionalImages: true } },
        JobVehicleParts: true,
        materialIssues: { select: { id: true } }
      }
    },
    SaleSpareInvoiceItem: {
      include: {
        partNumber: { include: { hsn: true, manufacturer: true, vehicleSuit: { include: { VehicleMaster: true } } } },
        jobCode: { 
          include: { 
            sac: true,
            JobCodePrice: { include: { vehicle: true } }
          } 
        },
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
    },
    transactions: true
  };

  /**
   * Helper to format SaleSpareInvoice object to match legacy structure.
   */
  formatSaleSpareInvoice = (invoice) => {
    if (!invoice) return null;
    const formatted = { ...invoice };

    // Map fields for legacy parity
    if (formatted.partyName) {
      formatted.partyName.contacts = formatted.partyName.contacts || formatted.partyName.CustomerPhone || [];
      if (formatted.partyName.quotation) {
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
        // Map Insurance relation to legacy 'insurance'
        formatted.jobOrder.vehicle.insurance = formatted.jobOrder.vehicle.insurance || [];
      }
      if (formatted.jobOrder.mechanic) {
        formatted.jobOrder.mechanic.profile = formatted.jobOrder.mechanic.EmployeeProfile_User_profileToEmployeeProfile;
      }
      formatted.jobOrder.complaint = formatted.jobOrder.JobVehicleComplaint || [];
      formatted.jobOrder.parts = formatted.jobOrder.JobVehicleParts || {};
      formatted.jobOrder.vehicleImage = formatted.jobOrder.JobVehicleImage || {};
      
      // Alias to 'job' for legacy parity in some contexts
      formatted.job = formatted.jobOrder.id;
    }

    if (formatted.SaleSpareInvoiceItem) {
      formatted.saleItemInvoice = formatted.SaleSpareInvoiceItem.map(item => {
        const mappedItem = { ...item };
        
        // Handle PartMaster relation
        if (item.partNumber) {
          const p = item.partNumber;
          const partObj = {
            id: p.id,
            partNumber: p.partNumber,
            number: p.partNumber,
            partName: item.partName || p.partName,
            hsn: p.hsn || item.hsn,
            manufacturer: p.manufacturer
          };
          mappedItem.partNumber = partObj;
          mappedItem.partNo = partObj; // Legacy compatibility
        } 
        // Handle JobCode relation
        else if (item.jobCode) {
          const j = item.jobCode;
          const jobObj = {
            id: j.id,
            code: j.code,
            partNumber: j.code, // Map code to partNumber for table display
            partName: j.code,
            hsn: j.sac,
            sac: j.sac,
            vehicleModel: j.JobCodePrice || []
          };
          mappedItem.partNumber = jobObj;
          mappedItem.partNo = jobObj;
          mappedItem.hsn = j.sac;
          mappedItem.sac = j.sac;
        }

        // Ensure HSN is flattened if present
        mappedItem.hsn = mappedItem.hsn || item.hsn || item.sac || null;

        // Convert item-level Decimal fields from Prisma strings to numbers
        const itemDecimalFields = ['quantity', 'unitRate', 'gstRate', 'cgst', 'sgst', 'igst',
          'igstAmount', 'cgstAmount', 'sgstAmount', 'discountAmount', 'discountPercent'];
        itemDecimalFields.forEach(field => {
          if (mappedItem[field] !== undefined && mappedItem[field] !== null) {
            mappedItem[field] = Number(mappedItem[field]);
          }
        });
        
        return mappedItem;
      });
      delete formatted.SaleSpareInvoiceItem;
    }

    // Numeric conversion for Decimal fields
    ['totalInvoice', 'cgst', 'sgst', 'igst', 'totalDiscount', 'adjustment', 'discountPercent', 'discountRate', 'tcs', 'labourCharge', 'partsCharge', 'consumableCharge'].forEach(field => {
      if (formatted[field] !== undefined && formatted[field] !== null) {
        formatted[field] = Number(formatted[field]);
      }
    });

    return formatted;
  };

  /**
   * Helper to update inventory accQuantity and/or phyQuantity
   */
  updateInventory = async ({ partId, branchId, quantity, type = "DECREASE", invoiceType = "jobOrder" }, txClient = null) => {
    try {
      const db = txClient || prisma;
      const inventory = await db.sparesInventory.findFirst({
        where: { partId, branchId }
      });

      if (!inventory) {
        logger.warn(`SparesInventory not found for part ${partId} in branch ${branchId}`);
        return;
      }

      let newAcc = Number(inventory.accQuantity || 0);
      let newPhy = Number(inventory.phyQuantity || 0);
      const q = Number(quantity || 0);

      if (type === "DECREASE") {
        newAcc -= q;
        if (invoiceType === "counterSale") {
          newPhy -= q;
        }
      } else {
        newAcc += q;
        if (invoiceType === "counterSale") {
          newPhy += q;
        }
      }

      await db.sparesInventory.update({
        where: { id: inventory.id },
        data: {
          accQuantity: Math.max(0, newAcc),
          phyQuantity: Math.max(0, newPhy)
        }
      });
    } catch (err) {
      logger.error("Error updating inventory:", err);
    }
  };

  createJobInvoice = async (req, res) => {
    try {
      const {
        invoiceNumber, invoiceDate, jobOrder, job, totalInvoice, adjustments, 
        remarks, internalComments, tcs, labourCharge, consumableCharge, partsCharge,
        cgst, sgst, igst, totalDiscount, discountType, discountPercent, discountRate,
        saleItemInvoice, partyName, invoiceType = "jobOrder"
      } = req.body;
      const jobId = jobOrder || job;
      const user = req.user?.id || req.headers["user-id"];

      if (!jobId && invoiceType === "jobOrder") {
        return res.json({ code: 400, response: { code: 400, message: "Missing job order ID" } });
      }

      // 1. Fetch JobOrder to get branchId and default partyName
      let jo = null;
      if (jobId) {
        jo = await prisma.jobOrder.findUnique({ 
          where: { id: jobId }, 
          select: { branchId: true, customerId: true } 
        });
      }
      const branchId = jo?.branchId || req.body.branch;

      const created = await prisma.$transaction(async (tx) => {
        // 2. Create the SaleSpareInvoice
        const invoice = await tx.saleSpareInvoice.create({
          data: {
            invoiceNumber,
            invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
            totalInvoice: parseFloat(totalInvoice) || 0,
            adjustment: parseFloat(adjustments) || 0,
            invoiceType: invoiceType || "jobOrder",
            status: "INVOICED",
            remarks,
            internalComments,
            tcs: parseFloat(tcs) || 0,
            labourCharge: parseFloat(labourCharge) || 0,
            consumableCharge: parseFloat(consumableCharge) || 0,
            partsCharge: parseFloat(partsCharge) || 0,
            cgst: parseFloat(cgst) || 0,
            sgst: parseFloat(sgst) || 0,
            igst: parseFloat(igst) || 0,
            totalDiscount: parseFloat(totalDiscount) || 0,
            discountType,
            discountPercent: parseFloat(discountPercent) || 0,
            discountRate: parseFloat(discountRate) || 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            jobOrder: jobId ? { connect: { id: jobId } } : undefined,
            partyName: (partyName || jo?.customerId) ? { connect: { id: partyName || jo?.customerId } } : undefined,
            branch: branchId ? { connect: { id: branchId } } : undefined,
            SaleSpareInvoiceItem: saleItemInvoice && saleItemInvoice.length > 0 ? {
              create: saleItemInvoice.map(item => {
                const isJobCode = !!(item.partNumber?.isJobCode || item.partNumber?.code || item.jobCode);
                const isPart = !isJobCode && !!(item.partNumber?.partNumber || (item.partNumber?.id && !item.partNumber?.code));
                // item-level discount: frontend sends discountAmount (raw value) and discountPercent (non-zero only for % mode)
                const itemDiscountAmount = parseFloat(item.discountAmount ?? item.discount) || 0;
                const itemDiscountPercent = parseFloat(item.discountPercent) || 0;
                
                return {
                  partNumber: (isPart && item.partNumber?.id) ? { connect: { id: item.partNumber.id } } : undefined,
                  jobCode: (isJobCode && item.partNumber?.id) ? { connect: { id: item.partNumber.id } } : undefined,
                  partName: item.partName || item.partNumber?.partName || item.partNumber?.code || item.partNumber?.partNumber,
                  quantity: parseFloat(item.quantity) || 0,
                  unitRate: parseFloat(item.unitRate) || 0,
                  gstRate: parseFloat(item.gstRate) || 0,
                  cgst: parseFloat(item.cgst) || 0,
                  sgst: parseFloat(item.sgst) || 0,
                  igst: parseFloat(item.igst) || 0,
                  discountAmount: itemDiscountAmount,
                  discountPercent: itemDiscountPercent,
                  hsn: (isPart && item.hsn?.id) ? { connect: { id: item.hsn.id } } : undefined,
                  sac: (isJobCode && (item.sac?.id || item.hsn?.id)) ? { connect: { id: item.sac?.id || item.hsn?.id } } : undefined,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  branch: branchId ? { connect: { id: branchId } } : undefined
                };
              })
            } : undefined
          },
          include: { SaleSpareInvoiceItem: true }
        });

        // 3. Update Inventory and Create Transactions
        if (saleItemInvoice && saleItemInvoice.length > 0) {
          for (let item of invoice.SaleSpareInvoiceItem) {
            if (item.partNumberId) {
               await this.updateInventory({
                 partId: item.partNumberId,
                 branchId,
                 quantity: item.quantity,
                 type: "DECREASE",
                 invoiceType
               }, tx);

               await tx.transactions.create({
                 data: {
                   Part: { connect: { id: item.partNumberId } },
                   Quantity: parseInt(item.quantity) || 0,
                   type: invoiceType === "counterSale" ? "Counter Sale" : "Sale Spare Invoice",
                   sparesSale: { connect: { id: invoice.id } },
                   branch: branchId ? { connect: { id: branchId } } : undefined,
                   createdAt: new Date()
                 }
               });
            }
          }
        }

        // 4. Update JobOrder status
        if (jobId) {
          await tx.jobOrder.update({
            where: { id: jobId },
            data: { jobStatus: "Proforma Invoice" }
          });

          await tx.jobOrderLog.create({
            data: {
              event: "INVOICE_GENERATED",
              data: `Invoice ${invoice.invoiceNumber} generated. Total: ${invoice.totalInvoice}`,
              JobOrder: { connect: { id: jobId } },
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
        }

        // 5. Increment ID counter
        await IdGenerateController.incrementId("JOBINVOICE", branchId);

        return invoice;
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Job invoice created successfully",
          data: this.formatSaleSpareInvoice(created)
        }
      });
    } catch (err) {
      logger.error("Create job invoice error:", err);
      return res.json({ code: 500, response: { code: 500, message: "An error occured", data: err.message } });
    }
  };

  updateJobInvoice = async (req, res) => {
    try {
      const { id } = req.params;
      const {
        invoiceNumber, totalInvoice, adjustments, adjustment, remarks, internalComments,
        tcs, labourCharge, consumableCharge, partsCharge, cgst, sgst, igst,
        totalDiscount, discountType, discountPercent, discountRate, saleItemInvoice,
        invoiceType = "jobOrder"
      } = req.body;

      const finalAdjustment = adjustments !== undefined ? adjustments : adjustment;

      // 1. Fetch old invoice to calculate inventory diff
      const oldInvoice = await prisma.saleSpareInvoice.findUnique({
        where: { id },
        include: { SaleSpareInvoiceItem: true }
      });

      if (!oldInvoice) return res.json({ code: 404, message: "Invoice not found" });

      const updated = await prisma.$transaction(async (tx) => {
        // 2. Restore Inventory from old items
        for (let item of oldInvoice.SaleSpareInvoiceItem) {
          if (item.partNumberId) {
            await this.updateInventory({
              partId: item.partNumberId,
              branchId: oldInvoice.branchId,
              quantity: item.quantity,
              type: "INCREASE",
              invoiceType: oldInvoice.invoiceType
            }, tx);
          }
        }

        // 3. Delete existing items and Transactions
        await tx.saleSpareInvoiceItem.deleteMany({ where: { SaleSpareInvoice: { some: { id } } } });
        await tx.transactions.deleteMany({ where: { sparesSaleId: id } });

        // 4. Update the main invoice record
        const updatedInvoice = await tx.saleSpareInvoice.update({
          where: { id },
          data: {
            invoiceNumber,
            totalInvoice: totalInvoice ? parseFloat(totalInvoice) : undefined,
            adjustment: finalAdjustment !== undefined ? parseFloat(finalAdjustment) : undefined,
            remarks,
            internalComments,
            tcs: tcs !== undefined ? parseFloat(tcs) : undefined,
            labourCharge: labourCharge !== undefined ? parseFloat(labourCharge) : undefined,
            consumableCharge: consumableCharge !== undefined ? parseFloat(consumableCharge) : undefined,
            partsCharge: partsCharge !== undefined ? parseFloat(partsCharge) : undefined,
            cgst: cgst !== undefined ? parseFloat(cgst) : undefined,
            sgst: sgst !== undefined ? parseFloat(sgst) : undefined,
            igst: igst !== undefined ? parseFloat(igst) : undefined,
            totalDiscount: totalDiscount !== undefined ? parseFloat(totalDiscount) : undefined,
            discountType,
            discountPercent: parseFloat(discountPercent) || 0,
            discountRate: parseFloat(discountRate) || 0,
            updatedAt: new Date(),
            SaleSpareInvoiceItem: saleItemInvoice && saleItemInvoice.length > 0 ? {
              create: saleItemInvoice.map(item => {
                const isJobCode = !!(item.partNumber?.isJobCode || item.partNumber?.code || item.jobCode);
                const isPart = !isJobCode && !!(item.partNumber?.partNumber || (item.partNumber?.id && !item.partNumber?.code));
                
                return {
                  partNumber: (isPart && item.partNumber?.id) ? { connect: { id: item.partNumber.id } } : undefined,
                  jobCode: (isJobCode && item.partNumber?.id) ? { connect: { id: item.partNumber.id } } : undefined,
                  partName: item.partName || item.partNumber?.partName || item.partNumber?.code || item.partNumber?.partNumber,
                  quantity: parseFloat(item.quantity) || 0,
                  unitRate: parseFloat(item.unitRate) || 0,
                  gstRate: parseFloat(item.gstRate) || 0,
                  cgst: parseFloat(item.cgst) || 0,
                  sgst: parseFloat(item.sgst) || 0,
                  igst: parseFloat(item.igst) || 0,
                  // item-level discount: frontend sends discountAmount and discountPercent (non-zero only for % mode)
                  discountAmount: parseFloat(item.discountAmount ?? item.discount) || 0,
                  discountPercent: parseFloat(item.discountPercent) || 0,
                  hsn: (isPart && item.hsn?.id) ? { connect: { id: item.hsn.id } } : undefined,
                  sac: (isJobCode && (item.sac?.id || item.hsn?.id)) ? { connect: { id: item.sac?.id || item.hsn?.id } } : undefined,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  branch: oldInvoice.branchId ? { connect: { id: oldInvoice.branchId } } : undefined
                };
              })
            } : undefined
          },
          include: { SaleSpareInvoiceItem: true }
        });

        // 5. Apply new Inventory changes and Create Transactions
        if (updatedInvoice.SaleSpareInvoiceItem && updatedInvoice.SaleSpareInvoiceItem.length > 0) {
          for (let item of updatedInvoice.SaleSpareInvoiceItem) {
            if (item.partNumberId) {
               await this.updateInventory({
                 partId: item.partNumberId,
                 branchId: oldInvoice.branchId,
                 quantity: item.quantity,
                 type: "DECREASE",
                 invoiceType: updatedInvoice.invoiceType
               }, tx);

               await tx.transactions.create({
                 data: {
                   Part: { connect: { id: item.partNumberId } },
                   Quantity: parseInt(item.quantity) || 0,
                   type: updatedInvoice.invoiceType === "counterSale" ? "Counter Sale" : "Sale Spare Invoice",
                   sparesSale: { connect: { id: updatedInvoice.id } },
                   branch: oldInvoice.branchId ? { connect: { id: oldInvoice.branchId } } : undefined,
                   createdAt: new Date()
                 }
               });
            }
          }
        }

        return updatedInvoice;
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Job invoice updated successfully",
          data: this.formatSaleSpareInvoice(updated)
        }
      });
    } catch (err) {
      logger.error("Update job invoice error:", err);
      return res.json({ code: 500, response: { code: 500, message: "Server error", error: err.message } });
    }
  };

  deleteJobInvoice = async (req, res) => {
    try {
      const { id } = req.params;
      
      const invoice = await prisma.saleSpareInvoice.findUnique({
        where: { id },
        include: { SaleSpareInvoiceItem: true }
      });

      if (invoice) {
        await prisma.$transaction(async (tx) => {
          // 1. Restore Inventory
          for (let item of invoice.SaleSpareInvoiceItem) {
            if (item.partNumberId) {
              await this.updateInventory({
                partId: item.partNumberId,
                branchId: invoice.branchId,
                quantity: item.quantity,
                type: "INCREASE",
                invoiceType: invoice.invoiceType
              }, tx);
            }
          }

          // 2. Delete Transactions and Items
          await tx.transactions.deleteMany({ where: { sparesSaleId: id } });
          await tx.saleSpareInvoiceItem.deleteMany({ where: { SaleSpareInvoice: { some: { id } } } });

          // 3. Update JobOrder status back to WIP (Legacy behavior)
          if (invoice.jobOrderId) {
             await tx.jobOrder.update({
               where: { id: invoice.jobOrderId },
               data: { jobStatus: "Work In Progress" }
             });
          }

          // 4. Delete Invoice
          await tx.saleSpareInvoice.delete({ where: { id } });
        });
      } else {
        // Fallback for JobInvoice table
        await prisma.jobInvoice.delete({ where: { id } });
      }

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Job invoice deleted successfully"
        }
      });
    } catch (err) {
      logger.error("Delete job invoice error:", err);
      return res.json({ code: 500, response: { code: 500, message: "Server error" } });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      
      const invoice = await prisma.saleSpareInvoice.findUnique({
        where: { id },
        include: this.saleSpareInclude
      });

      if (invoice) {
        const payments = await prisma.payment.findMany({
          where: { moduleId: id, module: "JOB_INVOICE" },
          include: { denominations: true, collectedBy: true, paidBy: true, branch: true, bank: true },
          orderBy: { createdAt: 'asc' }
        });

        const formatted = this.formatSaleSpareInvoice(invoice);
        formatted.payments = payments;
        formatted.payment = payments;

        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "purchase share invoice fetched",
            data: formatted
          }
        });
      }

      return res.json({ code: 404, response: { code: 404, message: "Not found" } });
    } catch (err) {
      logger.error("Get one job invoice error:", err);
      return res.json({ code: 500, response: { code: 500, message: "Server error" } });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString, jobStatus, branch = [], status = "" } = req.body;
      const skip = (page - 1) * size;

      const where = {
        AND: [
          { invoiceType: "jobOrder" },
          searchString ? {
            OR: [
              { invoiceNumber: { contains: searchString, mode: 'insensitive' } },
              { jobOrder: { jobNo: { contains: searchString, mode: 'insensitive' } } },
              { partyName: { name: { contains: searchString, mode: 'insensitive' } } }
            ]
          } : {},
          branch.length > 0 ? { branchId: { in: branch } } : {},
          jobStatus ? {
            jobOrder: { jobStatus: Array.isArray(jobStatus) ? { in: jobStatus } : jobStatus }
          } : {},
          (status && typeof status === 'string') ? { status: status.replace("!", "") } : {}
        ]
      };

      const [count, invoices] = await Promise.all([
        prisma.saleSpareInvoice.count({ where }),
        prisma.saleSpareInvoice.findMany({
          where,
          skip: skip || 0,
          take: size || 10,
          orderBy: { createdAt: 'desc' },
          include: this.saleSpareInclude
        })
      ]);

      const formattedInvoices = invoices.map(inv => this.formatSaleSpareInvoice(inv));

      // Attach payment records so frontend can compute remaining amount
      if (formattedInvoices.length > 0) {
        const invoiceIds = formattedInvoices.map(inv => inv.id);
        const payments = await prisma.payment.findMany({
          where: { module: "JOB_INVOICE", moduleId: { in: invoiceIds } },
          include: { denominations: true, collectedBy: true, paidBy: true, branch: true, bank: true }
        });
        const paymentMap = {};
        payments.forEach(p => {
          if (!paymentMap[p.moduleId]) paymentMap[p.moduleId] = [];
          paymentMap[p.moduleId].push(p);
        });
        formattedInvoices.forEach(inv => {
          inv.payment = paymentMap[inv.id] || [];
        });
      }

      return res.status(200).json({
        code: 200,
        response: {
          code: 200,
          message: "JobInvoices fetched",
          data: {
            count,
            saleSpareInvoice: formattedInvoices
          }
        }
      });
    } catch (err) {
      logger.error(err, "Get job invoice page error:");
      return res.json({ code: 500, response: { code: 500, message: "an error occurred" } });
    }
  };

  deletePart = async (req, res) => {
    try {
      const { invoiceId, partId } = req.body;
      const branchId = req.user?.branch?.[0]; // Fallback to user branch

      const item = await prisma.saleSpareInvoiceItem.findUnique({
        where: { id: partId },
        include: { SaleSpareInvoice: { select: { id: true, branchId: true, invoiceType: true } } }
      });

      if (item) {
        await prisma.$transaction(async (tx) => {
          // 1. Restore Inventory
          if (item.partNumberId) {
            await this.updateInventory({
              partId: item.partNumberId,
              branchId: item.SaleSpareInvoice[0]?.branchId || branchId,
              quantity: item.quantity,
              type: "INCREASE",
              invoiceType: item.SaleSpareInvoice[0]?.invoiceType || "jobOrder"
            }, tx);
          }

          // 2. Delete Transaction
          await tx.transactions.deleteMany({
            where: {
              partId: item.partNumberId,
              sparesSaleId: invoiceId,
              type: { in: ["Sale Spare Invoice", "Counter Sale"] }
            }
          });

          // 3. Disconnect/Delete Item
          await tx.saleSpareInvoiceItem.delete({ where: { id: partId } });
        });
      }

      return res.json({ code: 200, response: { code: 200, message: "Part deleted successfully" } });
    } catch (error) {
      logger.error("JobInvoice.deletePart error: ", error);
      return res.json({ code: 500, response: { code: 500, message: error.message } });
    }
  };

  updateStatus = async (req, res) => {
    try {
      const { id: paramsId } = req.params;
      const { id: bodyId, status } = req.body;
      const id = paramsId || bodyId;

      if (!id) return res.json({ code: 400, response: { code: 400, message: "Missing invoice ID" } });

      const invoice = await prisma.saleSpareInvoice.findUnique({
        where: { id },
        select: { jobOrderId: true, totalInvoice: true }
      });

      // === GUARD: If requesting PAID, verify actual payments cover the bill ===
      let resolvedStatus = status || "PAID";
      if (resolvedStatus === "PAID") {
        const allSuccessPayments = await prisma.payment.findMany({
          where: { module: "JOB_INVOICE", moduleId: id, status: "SUCCESS" }
        });
        const totalCollected = allSuccessPayments.reduce(
          (sum, p) => sum + Number(p.collectedAmount || 0), 0
        );
        const invoiceBillAmount = Number(invoice?.totalInvoice || 0);
        const isFullyPaid = invoiceBillAmount > 0 && totalCollected >= invoiceBillAmount;

        if (!isFullyPaid) {
          resolvedStatus = "INVOICED";
          logger.info(`[updateStatus] Blocked PAID for ${id}: collected=${totalCollected}, bill=${invoiceBillAmount} — keeping INVOICED`);
        }
      }

      const jobStatusToSet = resolvedStatus === "PAID" ? "PAID" : "Proforma Invoice";

      if (invoice && invoice.jobOrderId) {
        await prisma.jobOrder.update({
          where: { id: invoice.jobOrderId },
          data: { jobStatus: jobStatusToSet }
        });
      }

      await prisma.saleSpareInvoice.update({
        where: { id },
        data: { status: resolvedStatus }
      });

      return res.json({ code: 200, response: { code: 200, message: "Job status updated successfully" } });
    } catch (error) {
      logger.error("JobInvoice.updateStatus error: ", error);
      return res.json({ code: 500, response: { code: 500, message: error.message } });
    }
  };

  checkExistence = async (req, res) => {
    try {
      const { id: jobOrderId } = req.params;

      // 1. Check for existing Sale Spare Invoice
      const existingInvoices = await prisma.saleSpareInvoice.findMany({
        where: { jobOrderId },
        include: this.saleSpareInclude
      });

      if (existingInvoices && existingInvoices.length > 0) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "Job Invoice already exists for this Job Order - Cannot create new Job Invoice",
            data: existingInvoices
          }
        });
      }

      // 2. Fetch JobOrder details (simplified)
      const jobOrder = await prisma.jobOrder.findUnique({
        where: { id: jobOrderId },
        include: { branch: true } // Add ramp/mechanic if needed
      });

      // All clear
      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "No Job Invoice exists and Job Order is ready",
          data: null
        }
      });
    } catch (err) {
      logger.error("checkExistence error:", err);
      return res.json({ code: 500, response: { code: 500, message: "Server error" } });
    }
  };

  getJob = async (req, res) => {
    try {
      const { id } = req.params;
      const invoices = await prisma.saleSpareInvoice.findMany({
        where: { jobOrderId: id },
        orderBy: { createdAt: 'desc' },
        include: this.saleSpareInclude
      });

      if (invoices.length > 0) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "purchase share invoice fetched",
            data: this.formatSaleSpareInvoice(invoices[0])
          }
        });
      }
      return res.json({ code: 404, response: { code: 404, message: "Not found" } });
    } catch (err) {
      logger.error("Get job error:", err);
      return res.json({ code: 500, response: { code: 500, message: "Server error" } });
    }
  };

  saveFeedback = async (req, res) => {
    try {
      const { id, feedback } = req.body;
      await prisma.saleSpareInvoice.update({
        where: { id },
        data: { remarks: feedback }
      });
      return res.json({ code: 200, response: { code: 200, message: "Feedback saved successfully" } });
    } catch (error) {
      logger.error("JobInvoice.saveFeedback error: ", error);
      return res.json({ code: 500, response: { code: 500, message: error.message } });
    }
  };
}

export default new JobInvoiceController();

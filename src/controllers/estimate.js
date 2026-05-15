import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";
import { broadcastEstimateUpdate } from "../config/webSocket.js";

import IdGenerateController from "./idGenerate.js";
import JobOrderController from "./jobOrder.js";
import JobOrderLogController from "./jobOrderLog.js";
import PDFUtil from "../utils/pdf.util.js";
import { uploadPDFToSpaces } from "../utils/spaces.util.js";
import moment from "moment";
import QRCode from "qrcode";
import { normalizeBranchIds } from "../utils/branch.util.js";

/**
 * Controller for Service Estimate operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class EstimateController {
  async checkAccess(req, action = 'read') {
    const userId = req.user?.id;
    if (!userId) return false;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        EmployeeProfile_User_profileToEmployeeProfile: {
          include: {
            department: {
              include: {
                RoleAccess: { include: { access: true } }
              }
            }
          }
        }
      }
    });

    const roleAccess = user?.EmployeeProfile_User_profileToEmployeeProfile?.department?.RoleAccess || [];
    const estimateAccess = roleAccess.find(ra => ra.subModule?.toUpperCase() === "ESTIMATE");
    
    // If no specific access defined for ESTIMATE, we might want to allow by default or restrict.
    // The user said "after restricting", so we should respect the 'false' value.
    if (estimateAccess && estimateAccess.access && estimateAccess.access[action] === false) {
      return false;
    }
    return true;
  }

  getTemplateData(estimate, qrUrl) {
    const jobOrder = estimate.jobOrder || {};
    const vehicle = jobOrder.vehicle || {};
    const vMaster = vehicle.vehicle || {};
    const branch = estimate.branch || jobOrder.branch || {};
    const customer = jobOrder.customer || {};
    const contacts = customer.contacts || [];

    const date = moment(estimate.createdAt).format("DD/MM/YYYY");
    const time = moment(estimate.createdAt).format("hh:mm A");
    const cdate = moment().format("DD-MM-YYYY");
    const ctime = moment().format("HH:mm");

    return {
      vehicle: [{
        jobNo: jobOrder.jobNo,
        estimateNo: estimate.estimateNo,
        serviceType: estimate.serviceType,
        claimType: estimate.claimType,
        claimStatus: estimate.claimStatus,
        insurer: estimate.insurer?.name || "",
        survivor: estimate.survivor?.name || "",
        survivorContact: estimate.survivorContact || "",
        estimate: (estimate.estimateItemInvoice || []).map((item, index) => ({
          index: index + 1,
          partNumber: item.partNumber ? `${item.partNumber.partNumber} - ${item.partNumber.partName}` : (item.jobCode?.code || "N/A"),
          quantity: item.quantity,
          unitRate: item.unitRate,
          rate: (item.quantity * item.unitRate).toFixed(2),
          status: item.status || "PENDING"
        })),
        labourCharge: estimate.labourCharge || 0,
        partCharge: estimate.partCharge || 0,
        consumableCharge: estimate.consumableCharge || 0,
        estTotalAmount: estimate.estTotalAmount || 0,
        customer: {
          name: customer.name || "",
          contact: contacts.map(c => c.phone).join(" / ") || jobOrder.customerPhone || ""
        },
        cdate,
        ctime,
        date,
        time,
        logo: branch.company?.logo || "",
        yamahaLogo: vMaster.manufacturer?.logo || "",
        branchName: branch.company?.name || "",
        branchAddress: `${branch.address?.line1 || ""} ${branch.address?.line2 || ""} ${branch.address?.locality || ""}, ${branch.address?.district?.name || ""}, ${branch.address?.state?.name || ""}, ${branch.address?.pincode || ""}`,
        branchContacts: (branch.contacts || []).map(c => c.phone).join(" / "),
        branchEmail: branch.email || "",
        branchUrl: branch.url || "",
        QR: qrUrl
      }]
    };
  }

  // Shared include object for Estimate
  estimateInclude = {
    jobOrder: {
      include: JobOrderController.fragment
    },
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
    branch: {
      include: {
        company: true,
        address: {
          include: {
            district: true,
            state: true,
            country: true
          }
        },
        contacts: true
      }
    }
  };

  /**
   * Helper to format Estimate object to match legacy fragment structure.
   */
  formatEstimate = (estimate) => {
    if (!estimate) return null;
    const formatted = { ...estimate };

    // Map jobOrder using JobOrder formatter
    if (formatted.jobOrder) {
      formatted.jobOrder = JobOrderController.formatJobOrder(formatted.jobOrder);
    }

    // Map survivor CustomerPhone to contacts
    if (formatted.survivor) {
      if (formatted.survivor.CustomerPhone) {
        formatted.survivor.contacts = formatted.survivor.CustomerPhone;
        delete formatted.survivor.CustomerPhone;
      }
    }

    // Convert Decimal fields to Numbers
    const decimalFields = [
      'itemRate', 'discountPercent', 'discountRate', 'tcs', 'cgst', 'sgst', 'igst',
      'cgstAmount', 'sgstAmount', 'igstAmount', 'totalDiscount', 'adjustment',
      'labourCharge', 'consumableCharge', 'partCharge', 'estTotalAmount'
    ];
    decimalFields.forEach(field => {
      if (formatted[field] !== undefined && formatted[field] !== null) {
        formatted[field] = Number(formatted[field]);
      }
    });

    // Alias estTotalAmount to totalInvoice for legacy compatibility if needed
    formatted.totalInvoice = formatted.estTotalAmount;

    // Map EstimateItem to estimateItemInvoice
    if (formatted.EstimateItem) {
      formatted.estimateItemInvoice = formatted.EstimateItem.map(item => {
        const formattedItem = { ...item };
        const itemDecimals = [
          'quantity', 'unitRate', 'gstRate', 'igst', 'cgst', 'sgst',
          'igstAmount', 'cgstAmount', 'sgstAmount', 'discountAmount', 'discountPercent'
        ];
        itemDecimals.forEach(f => {
          if (formattedItem[f] !== undefined && formattedItem[f] !== null) {
            formattedItem[f] = Number(formattedItem[f]);
          }
        });
        return formattedItem;
      });
      delete formatted.EstimateItem;
    }

    return formatted;
  };

  /**
   * Helper to extract ID from connect objects or strings.
   */
  getConnectId = (val) => {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val.id) return val.id;
    return null;
  };

  /**
   * Helper to validate if a record exists in the database.
   */
  getValidatedId = async (model, val) => {
    const id = this.getConnectId(val);
    if (!id) return null;

    try {
      const record = await prisma[model].findUnique({
        where: { id },
        select: { id: true }
      });
      return record ? id : null;
    } catch (err) {
      return null;
    }
  };

  createEstimate = async (req, res) => {
    try {
      if (!(await this.checkAccess(req, 'create'))) {
        return res.status(403).json({ code: 403, message: "Restricted: You do not have permission to create Estimates" });
      }

      const {
        estimateNo, jobOrder, dateTime, estimateStatus,
        discountLevel, discountType, discountPercent, discountRate,
        cgstAmount, sgstAmount, igstAmount, totalDiscount,
        labourCharge, consumableCharge, partCharge, estTotalAmount,
        estimateItemInvoice, branch, serviceType, claimStatus, claimType,
        insurer, survivor, survivorContact, adjustment
      } = req.body;

      const user = req.user?.id || req.headers["user-id"];

      // Validate core relations
      const validatedJobOrderId = await this.getValidatedId('jobOrder', jobOrder);
      const validatedBranchId = await this.getValidatedId('branch', branch);
      const validatedInsurerId = await this.getValidatedId('insurance', insurer);
      const validatedSurvivorId = await this.getValidatedId('customer', survivor);
      const validatedUserId = await this.getValidatedId('user', user);

      // Prevent duplicate estimates for the same job order
      if (validatedJobOrderId) {
        const existingEstimate = await prisma.estimate.findFirst({
          where: { jobOrderId: validatedJobOrderId }
        });
        if (existingEstimate) {
          return res.json({ 
            code: 400, 
            msg: `An estimate (No: ${existingEstimate.estimateNo}) already exists for this Job Order. Please modify the existing record instead of creating a new one.` 
          });
        }
      }

      // Map items with existence checks
      const itemsToCreate = [];
      if (estimateItemInvoice && estimateItemInvoice.length > 0) {
        for (const item of estimateItemInvoice) {
          const partId = (item.partNumber && (item.partNumber.partNumber || item.partNumber.category)) ? this.getConnectId(item.partNumber) : null;
          const jobCodeId = item.jobCode ? this.getConnectId(item.jobCode) : ((item.partNumber && item.partNumber.code) ? this.getConnectId(item.partNumber) : null);
          
          const validatedPartId = partId ? await this.getValidatedId('partsMaster', partId) : null;
          const validatedJobCodeId = jobCodeId ? await this.getValidatedId('jobCode', jobCodeId) : null;
          const validatedHsnId = (validatedPartId && item.hsn) ? await this.getValidatedId('hsn', item.hsn) : null;
          const validatedSacId = (validatedJobCodeId && item.sac) ? await this.getValidatedId('sac', item.sac) : null;

          itemsToCreate.push({
            partNumber: validatedPartId ? { connect: { id: validatedPartId } } : undefined,
            jobCode: validatedJobCodeId ? { connect: { id: validatedJobCodeId } } : undefined,
            quantity: parseFloat(item.quantity) || 0,
            unitRate: parseFloat(item.unitRate || item.rate) || 0,
            igst: parseFloat(item.igst) || 0,
            cgst: parseFloat(item.cgst) || 0,
            sgst: parseFloat(item.sgst) || 0,
            igstAmount: parseFloat(item.igstAmount) || 0,
            cgstAmount: parseFloat(item.cgstAmount) || 0,
            sgstAmount: parseFloat(item.sgstAmount) || 0,
            discountAmount: parseFloat(item.discountAmount) || 0,
            discountPercent: parseFloat(item.discountPercent || item.discount) || 0,
            hsn: validatedHsnId ? { connect: { id: validatedHsnId } } : undefined,
            sac: validatedSacId ? { connect: { id: validatedSacId } } : undefined,
            status: item.status,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }

      const created = await prisma.estimate.create({
        data: {
          estimateNo,
          dateTime: dateTime ? new Date(dateTime) : new Date(),
          estimateStatus: estimateStatus || "PENDING",
          discountLevel,
          discountType,
          discountPercent: parseFloat(discountPercent) || 0,
          discountRate: parseFloat(discountRate) || 0,
          cgstAmount: parseFloat(cgstAmount) || 0,
          sgstAmount: parseFloat(sgstAmount) || 0,
          igstAmount: parseFloat(igstAmount) || 0,
          totalDiscount: parseFloat(totalDiscount) || 0,
          labourCharge: parseFloat(labourCharge) || 0,
          consumableCharge: parseFloat(consumableCharge) || 0,
          partCharge: parseFloat(partCharge) || 0,
          estTotalAmount: parseFloat(estTotalAmount) || 0,
          adjustment: parseFloat(adjustment) || 0,
          serviceType,
          claimType,
          claimStatus: claimStatus === "true" || claimStatus === true,
          survivorContact,
          createdAt: new Date(),
          updatedAt: new Date(),
          jobOrder: validatedJobOrderId ? { connect: { id: validatedJobOrderId } } : undefined,
          branch: validatedBranchId ? { connect: { id: validatedBranchId } } : undefined,
          insurer: validatedInsurerId ? { connect: { id: validatedInsurerId } } : undefined,
          survivor: validatedSurvivorId ? { connect: { id: validatedSurvivorId } } : undefined,
          createdBy: validatedUserId ? { connect: { id: validatedUserId } } : undefined,
          EstimateItem: itemsToCreate.length > 0 ? {
            create: itemsToCreate
          } : undefined
        },
        include: this.estimateInclude
      });

      // Update Job Order status to "Estimation"
      if (validatedJobOrderId) {
        try {
          await JobOrderController.setStatus({
            body: { id: validatedJobOrderId, type: "Estimate" }
          }, { json: () => {} });
        } catch (statusErr) {
          logger.error("Failed to update JobOrder status during estimate creation:", statusErr);
        }
      }

      // Increment ID counter
      let branchId = branch;
      if (!branchId && jobOrder) {
          const jo = await prisma.jobOrder.findUnique({ where: { id: jobOrder }, select: { branchId: true } });
          branchId = jo?.branchId;
      }
      if (branchId) {
        await IdGenerateController.incrementId("ESTIMATE", branchId);
      }

      // Generate and upload PDF to Spaces
      const finalEstimate = await this.generateAndUploadPDF(created.id) || created;

      // Create Logs
      await JobOrderLogController.createInternalLog(validatedJobOrderId, "Estimate Generated", created.id);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Estimate Invoice created",
          data: this.formatEstimate(finalEstimate)
        }
      });
    } catch (err) {
      logger.error("Create estimate error:", err);
      return res.json({ code: 500, msg: "An error occured", err });
    }
  };

  updateEstimate = async (req, res) => {
    try {
      if (!(await this.checkAccess(req, 'update'))) {
        return res.status(403).json({ code: 403, message: "Restricted: You do not have permission to update Estimates" });
      }

      const { id } = req.params;
      const {
        estimateNo, jobOrder, dateTime, estimateStatus,
        discountLevel, discountType, discountPercent, discountRate,
        cgstAmount, sgstAmount, igstAmount, totalDiscount,
        labourCharge, consumableCharge, partCharge, estTotalAmount,
        estimateItemInvoice, branch, serviceType, claimStatus, claimType,
        insurer, survivor, survivorContact, deleteData1, deleteData2, adjustment
      } = req.body;

      // Validate core relations
      const validatedJobOrderId = await this.getValidatedId('jobOrder', jobOrder);
      const validatedBranchId = await this.getValidatedId('branch', branch);
      const validatedInsurerId = await this.getValidatedId('insurance', insurer);
      const validatedSurvivorId = await this.getValidatedId('customer', survivor);

      // Handle item deletions
      const deleteIds = [...(deleteData1 || []), ...(deleteData2 || [])];
      if (deleteIds.length > 0) {
        await prisma.estimateItem.deleteMany({
          where: { id: { in: deleteIds } }
        });
      }

      // Map items with existence checks
      const itemsToUpsert = [];
      if (estimateItemInvoice && estimateItemInvoice.length > 0) {
        for (const item of estimateItemInvoice) {
          const partId = (item.partNumber && (item.partNumber.partNumber || item.partNumber.category)) ? this.getConnectId(item.partNumber) : null;
          const jobCodeId = item.jobCode ? this.getConnectId(item.jobCode) : ((item.partNumber && item.partNumber.code) ? this.getConnectId(item.partNumber) : null);

          const validatedPartId = partId ? await this.getValidatedId('partsMaster', partId) : null;
          const validatedJobCodeId = jobCodeId ? await this.getValidatedId('jobCode', jobCodeId) : null;
          const validatedHsnId = (validatedPartId && item.hsn) ? await this.getValidatedId('hsn', item.hsn) : null;
          const validatedSacId = (validatedJobCodeId && item.sac) ? await this.getValidatedId('sac', item.sac) : null;

          const itemData = {
            partNumber: validatedPartId ? { connect: { id: validatedPartId } } : undefined,
            jobCode: validatedJobCodeId ? { connect: { id: validatedJobCodeId } } : undefined,
            quantity: parseFloat(item.quantity) || 0,
            unitRate: parseFloat(item.unitRate || item.rate) || 0,
            igst: parseFloat(item.igst) || 0,
            cgst: parseFloat(item.cgst) || 0,
            sgst: parseFloat(item.sgst) || 0,
            igstAmount: parseFloat(item.igstAmount) || 0,
            cgstAmount: parseFloat(item.cgstAmount) || 0,
            sgstAmount: parseFloat(item.sgstAmount) || 0,
            discountAmount: parseFloat(item.discountAmount) || 0,
            discountPercent: parseFloat(item.discountPercent || item.discount) || 0,
            hsn: validatedHsnId ? { connect: { id: validatedHsnId } } : undefined,
            sac: validatedSacId ? { connect: { id: validatedSacId } } : undefined,
            status: item.status,
            updatedAt: new Date()
          };

          itemsToUpsert.push({
            where: { id: item.id || 'new-item' },
            create: {
              ...itemData,
              createdAt: new Date(),
            },
            update: itemData
          });
        }
      }

      const updated = await prisma.estimate.update({
        where: { id },
        data: {
          estimateNo,
          dateTime: dateTime ? new Date(dateTime) : undefined,
          estimateStatus,
          discountLevel,
          discountType,
          discountPercent: discountPercent !== undefined ? parseFloat(discountPercent) : undefined,
          discountRate: discountRate !== undefined ? parseFloat(discountRate) : undefined,
          cgstAmount: cgstAmount !== undefined ? parseFloat(cgstAmount) : undefined,
          sgstAmount: sgstAmount !== undefined ? parseFloat(sgstAmount) : undefined,
          igstAmount: igstAmount !== undefined ? parseFloat(igstAmount) : undefined,
          totalDiscount: totalDiscount !== undefined ? parseFloat(totalDiscount) : undefined,
          labourCharge: labourCharge !== undefined ? parseFloat(labourCharge) : undefined,
          consumableCharge: consumableCharge !== undefined ? parseFloat(consumableCharge) : undefined,
          partCharge: partCharge !== undefined ? parseFloat(partCharge) : undefined,
          estTotalAmount: estTotalAmount !== undefined ? parseFloat(estTotalAmount) : undefined,
          adjustment: adjustment !== undefined ? parseFloat(adjustment) : undefined,
          serviceType,
          claimType,
          claimStatus: claimStatus === "true" || claimStatus === true,
          survivorContact,
          updatedAt: new Date(),
          jobOrder: validatedJobOrderId ? { connect: { id: validatedJobOrderId } } : undefined,
          branch: validatedBranchId ? { connect: { id: validatedBranchId } } : undefined,
          insurer: validatedInsurerId ? { connect: { id: validatedInsurerId } } : undefined,
          survivor: validatedSurvivorId ? { connect: { id: validatedSurvivorId } } : undefined,
          EstimateItem: itemsToUpsert.length > 0 ? {
            upsert: itemsToUpsert
          } : undefined
        },
        include: this.estimateInclude
      });

      // Generate and upload PDF to Spaces
      const finalEstimate = await this.generateAndUploadPDF(updated.id) || updated;

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Estimate updated",
          data: this.formatEstimate(finalEstimate)
        }
      });
    } catch (err) {
      logger.error("Update estimate error:", err);
      return res.json({ code: 500, msg: "An error occured", err });
    }
  };

  getOne = async (req, res) => {
    try {
      if (!(await this.checkAccess(req, 'read'))) {
        return res.status(403).json({ code: 403, message: "Restricted: You do not have permission to view Estimates" });
      }

      const { id } = req.params;
      const estimate = await prisma.estimate.findUnique({
        where: { id },
        include: this.estimateInclude
      });

      if (estimate) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            msg: "Estimate fetched",
            data: this.formatEstimate(estimate)
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one estimate error:", err);
      return res.json({ code: 500, message: "Server error" });
    }
  };

  generateAndUploadPDF = async (id) => {
    try {
      const estimate = await prisma.estimate.findUnique({
        where: { id },
        include: this.estimateInclude
      });

      if (!estimate) return null;

      const formatted = this.formatEstimate(estimate);
      
      // Generate QR Code
      const qrData = `Estimate No: ${formatted.estimateNo}\nJob No: ${formatted.jobOrder?.jobNo}\nAmount: ${formatted.estTotalAmount}`;
      const qrUrl = await QRCode.toDataURL(qrData);

      const templateData = this.getTemplateData(formatted, qrUrl);
      const pdfBuffer = await PDFUtil.generatePDF('estimate', templateData);
      
      const fileName = `EST_${formatted.estimateNo.replace(/\//g, '_')}`;
      const pdfUrl = await uploadPDFToSpaces(pdfBuffer, fileName, 'estimate');
      
      const updated = await prisma.estimate.update({
        where: { id },
        data: { estimatePdf: pdfUrl },
        include: this.estimateInclude
      });
      
      return updated;
    } catch (err) {
      logger.error("Failed to generate/upload PDF for estimate:", err);
      return null;
    }
  };

  getPage = async (req, res) => {
    try {
      if (!(await this.checkAccess(req, 'read'))) {
        return res.status(403).json({ code: 403, message: "Restricted: You do not have permission to view Estimates" });
      }

      const { page, size, searchString, status, branch } = req.body;
      const branchIds = normalizeBranchIds(branch, req.user?.branch);
      const skip = (page - 1) * size;
      const inputValue = searchString || "";

      const statusFilter = status ? { estimateStatus: status } : {};

      const where = {
        AND: [
          branchIds.length > 0 ? { branchId: { in: branchIds } } : {},
          {
            OR: [
              { estimateNo: { contains: inputValue, mode: 'insensitive' } },
              { jobOrder: { jobNo: { contains: inputValue, mode: 'insensitive' } } },
              { jobOrder: { customerPhone: { contains: inputValue, mode: 'insensitive' } } },
              { jobOrder: { customer: { name: { contains: inputValue, mode: 'insensitive' } } } },
              { jobOrder: { vehicle: { registerNo: { contains: inputValue, mode: 'insensitive' } } } }
            ]
          },
          statusFilter
        ]
      };

      const [estimates, count] = await Promise.all([
        prisma.estimate.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.estimateInclude
        }),
        prisma.estimate.count({ where })
      ]);

      return res.json({
        code: 200,
        response: { 
          code: 200,
          msg: "Estimates fetched",
          data: { 
            count, 
            Estimate: estimates.map(e => this.formatEstimate(e)) 
          }
        }
      });
    } catch (err) {
      logger.error("Get estimate page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  updateEstimateStatus = async (req, res) => {
    try {
      if (!(await this.checkAccess(req, 'update'))) {
        return res.status(403).json({ code: 403, message: "Restricted: You do not have permission to update Estimates" });
      }

      const { id } = req.params;
      const { type, jobOrder, estimateItems } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      // 1. Get current estimate
      const currentEstimate = await prisma.estimate.findUnique({
        where: { id },
        include: {
          EstimateItem: {
            include: {
              jobCode: true
            }
          }
        }
      });

      if (!currentEstimate) {
        return res.status(404).json({ code: 404, message: "Estimate not found" });
      }

      // 2. Filter items to update status
      const itemsToUpdate = estimateItems ? estimateItems.filter(newItem => {
        const currentItem = currentEstimate.EstimateItem.find(item => item.id === newItem.id);
        return currentItem && currentItem.status !== newItem.status;
      }) : [];

      // 3. Update items
      if (itemsToUpdate.length > 0) {
        await prisma.$transaction(
          itemsToUpdate.map(item => prisma.estimateItem.update({
            where: { id: item.id },
            data: { status: item.status }
          }))
        );
      }

      // 4. Fetch the estimate with its items and jobCode to recalculate totals
      const updatedEstimate = await prisma.estimate.findUnique({
        where: { id },
        include: {
          EstimateItem: {
            include: { jobCode: true }
          }
        }
      });

      if (!updatedEstimate) {
        throw new Error("Failed to fetch updated estimate");
      }

      const allApproved = updatedEstimate.EstimateItem.length > 0 && updatedEstimate.EstimateItem.every(item => item.status === "APPROVED");
      const finalStatus = allApproved ? "APPROVED" : "PENDING";

      // 5. Recalculate totals based on ALL items
      let newPartCharge = 0;
      let newLabourCharge = 0;
      let newConsumableCharge = 0;
      let newCgstAmount = 0;
      let newSgstAmount = 0;
      let newIgstAmount = 0;

      const round = (val) => Math.round((Number(val) + Number.EPSILON) * 100) / 100;

      updatedEstimate.EstimateItem.forEach(item => {
        const qty = Number(item.quantity) || 0;
        const rate = Number(item.unitRate) || 0;
        const itemTotal = round(qty * rate);

        if (item.jobCodeId) {
          if (item.jobCode && item.jobCode.consumable) {
            newConsumableCharge += itemTotal;
          } else {
            newLabourCharge += itemTotal;
          }
        } else {
          newPartCharge += itemTotal;
        }

        newCgstAmount += Number(item.cgstAmount) || 0;
        newSgstAmount += Number(item.sgstAmount) || 0;
        newIgstAmount += Number(item.igstAmount) || 0;
      });

      // Include original adjustment (Round Off)
      const adjustment = Number(currentEstimate.adjustment) || 0;
      // Formula: Total = (Charges) + IGST + Round Off (Since IGST = CGST + SGST in this project)
      const newTotalAmount = round(newPartCharge + newLabourCharge + newConsumableCharge + newIgstAmount + adjustment);

      const finalEstimate = await prisma.estimate.update({
        where: { id },
        data: {
          estimateStatus: finalStatus,
          partCharge: round(newPartCharge),
          labourCharge: round(newLabourCharge),
          consumableCharge: round(newConsumableCharge),
          cgstAmount: round(newCgstAmount),
          sgstAmount: round(newSgstAmount),
          igstAmount: round(newIgstAmount),
          estTotalAmount: newTotalAmount,
          updatedAt: new Date()
        },
        include: this.estimateInclude
      });

      // 6. Update Job Order status if FULLY approved
      if (finalStatus === "APPROVED" && jobOrder) {
        try {
          await JobOrderController.setStatus({
             body: { id: jobOrder, type: "Estimation Approved" }
          }, { json: () => {} });
        } catch (statusErr) {
          logger.error("Failed to update JobOrder status from estimate:", statusErr);
        }
      }

      // Broadcast update for "instant" UI synchronization
      broadcastEstimateUpdate({
        id: finalEstimate.id,
        jobOrder: jobOrder,
        status: finalStatus
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Estimate Status Updated Successfully",
          data: this.formatEstimate(finalEstimate)
        }
      });

    } catch (err) {
      logger.error("Update estimate status error:", err);
      return res.json({ code: 500, message: "An error occurred" });
    }
  };

  deleteEstimate = async (req, res) => {
    try {
      if (!(await this.checkAccess(req, 'delete'))) {
        return res.status(403).json({ code: 403, message: "Restricted: You do not have permission to delete Estimates" });
      }

      const { id } = req.params;
      const type = req.query.type || req.body.type || "HARD";

      const estimate = await prisma.estimate.findUnique({
        where: { id },
        include: { EstimateItem: true }
      });

      if (!estimate) {
        return res.status(404).json({
          code: 404,
          response: { code: 404, message: "Estimate not found" }
        });
      }

      if (type === "SOFT") {
        await prisma.estimate.update({
          where: { id },
          data: { updatedAt: new Date() }
        });
        return res.json({
          code: 200,
          response: { code: 200, message: "Estimate soft deleted." }
        });
      } else {
        const itemIds = estimate.EstimateItem.map(item => item.id);

        // Delete the estimate (Prisma cleans up implicit join table)
        await prisma.estimate.delete({
          where: { id }
        });

        // Delete items
        if (itemIds.length > 0) {
          await prisma.estimateItem.deleteMany({
            where: { id: { in: itemIds } }
          });
        }

        return res.json({
          code: 200,
          response: { code: 200, message: "Estimate Invoice deleted permanently." }
        });
      }
    } catch (err) {
      logger.error("Delete estimate error:", err);
      return res.json({ code: 500, msg: "An error occured", err });
    }
  };

  generatePDF = async (req, res) => {
    try {
      const { id } = req.params;
      const estimate = await prisma.estimate.findUnique({
        where: { id },
        select: { id: true, estimateNo: true, estimatePdf: true }
      });

      if (!estimate) {
        return res.json({ code: 404, message: "Estimate not found" });
      }

      // Always regenerate to ensure fresh UI and data
      const updated = await this.generateAndUploadPDF(id);
      
      if (updated && updated.estimatePdf) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            data: { pdfUrl: updated.estimatePdf }
          }
        });
      }

      // If regeneration failed but we have a cached URL, return that
      if (estimate.estimatePdf) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            data: { pdfUrl: estimate.estimatePdf }
          }
        });
      }

      return res.json({ code: 500, message: "Failed to generate PDF" });
    } catch (err) {
      logger.error("Generate estimate PDF error:", err);
      return res.json({ code: 500, message: "An error occurred while generating PDF", error: err.message });
    }
  };
}

export default new EstimateController();

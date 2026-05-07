import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";
import moment from "moment";

import IdGenerateController from "./idGenerate.js";

/**
 * Controller for Vehicle Purchase Invoice operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class PurchaseInvoiceController {
  // Shared include object for VehiclePurchaseInvoice
  invoiceInclude = {
    VehiclePurchaseChallan: {
      include: {
        Supplier: {
          include: {
            address: { include: { district: true, state: true, country: true } },
            contact: true,
            bank: true
          }
        },
        Branch: {
          include: {
            address: { include: { district: true, state: true, country: true } },
            contacts: true
          }
        },
        PurchaseChallanHasVehicleDetails: {
          include: {
            PurchasedVehicleDetail: {
              include: {
                vehicle: {
                  include: {
                    manufacturer: true,
                    images: true,
                    files: true,
                    Hsn: true
                  }
                },
                color: true
              }
            }
          }
        }
      }
    },
    User: true
  };

  /**
   * Helper to transform Prisma output to match legacy frontend expectations
   */
  transformInvoice = (invoice) => {
    if (!invoice) return null;

    const challan = invoice.VehiclePurchaseChallan;
    const transformedChallan = challan ? {
      ...challan,
      supplier: challan.Supplier,
      branch: challan.Branch,
      vehicleDetail: challan.PurchaseChallanHasVehicleDetails?.map(junction => {
        const detail = junction.PurchasedVehicleDetail;
        return detail ? {
          ...detail,
          chassisNo: detail.chassisNo?.toUpperCase(),
          engineNo: detail.engineNo?.toUpperCase(),
          vehicle: detail.vehicle ? {
            ...detail.vehicle,
            manufacturer: detail.vehicle.manufacturer,
            image: detail.vehicle.images, // Frontend often expects 'image' or 'images'
            file: detail.vehicle.files,
            hsn: detail.vehicle.Hsn
          } : null
        } : null;
      }).filter(Boolean) || []
    } : null;

    // Remove the capitalized Prisma keys to avoid confusion
    if (transformedChallan) {
      delete transformedChallan.Supplier;
      delete transformedChallan.Branch;
      delete transformedChallan.PurchaseChallanHasVehicleDetails;
    }

    return {
      ...invoice,
      purchaseChallan: transformedChallan,
      user: invoice.User
    };
  };

  createPurchaseInvoice = async (req, res) => {
    try {
      const {
        date,
        invoiceNo,
        invoiceDate,
        quantity,
        amount,
        grossTotal,
        netAmount,
        roundOff,
        others,
        branch, // Branch ID
        vehicleDetail: selectVehicle, // Array of vehicle details
        supplier, // Supplier ID
        supplierInvoiceNo,
        challanData,
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      // 1. Chassis number validation
      for (const item of selectVehicle) {
        const manufacturerId = item.vehicle?.manufacturer?.id || null;
        const exists = await this.checkChassisNumberInternal(item.chassisNo, manufacturerId);
        if (exists.duplicate) {
          return res.json({
            code: 400,
            message: `Chassis number ${item.chassisNo} already exists`,
            data: null,
          });
        }
      }

      // 2. Generate Challan Number
      const challanNoRes = await IdGenerateController.purchaseChallanIdGenerate({ branch });
      const challanNo = challanNoRes.data;

      // 3. Prepare Vehicle Detail for Challan
      const vehicleDetailData = selectVehicle.map((item) => ({
        vehicleId: item.vehicle.id,
        chassisNo: item.chassisNo?.toUpperCase(),
        engineNo: item.engineNo?.toUpperCase(),
        keyNo: item.keyNo,
        warrantyBookNo: item.warrantyBookNo,
        colorId: item.color.id,
        batteryNo: item.batteryNo,
        manMonthYear: item.manMonthYear,
        invoiceAmount: parseFloat(item.invoiceAmount) || 0,
        createdAt: new Date()
      }));

      // 4. Create Challan (using Prisma transaction logic)
      console.log("Creating Challan with data:", {
        challanNo,
        supplier,
        branch,
        user,
        date: challanData?.date
      });
      const result = await prisma.$transaction(async (tx) => {
        // Create the Purchase Challan
        const challan = await tx.vehiclePurchaseChallan.create({
          data: {
            date: challanData?.date ? new Date(challanData.date) : new Date(),
            challanNo: challanNo,
            challanDate: challanData?.date ? new Date(challanData.date) : new Date(),
            supplierChallanNo: supplierInvoiceNo,
            createdAt: new Date(),
            updatedAt: new Date(),
            supplier: supplier,
            branch: branch,
            createdBy: user,
          }
        });
        console.log("Challan created:", challan.id);

        // Create individual PurchasedVehicleDetails and link via junction table
        const details = [];
        for (const v of vehicleDetailData) {
          const detail = await tx.purchasedVehicleDetail.create({
            data: {
              chassisNo: v.chassisNo,
              engineNo: v.engineNo,
              keyNo: v.keyNo,
              warrantyBookNo: v.warrantyBookNo,
              batteryNo: v.batteryNo,
              manMonthYear: v.manMonthYear,
              invoiceAmount: v.invoiceAmount,
              createdAt: v.createdAt,
              updatedAt: new Date(),
              vehicle: { connect: { id: v.vehicleId } },
              color: { connect: { id: v.colorId } }
            }
          });
          details.push(detail);

          await tx.purchaseChallanHasVehicleDetails.create({
            data: {
              A: challan.id,
              B: detail.id
            }
          });
        }

        // Create the Purchase Invoice
        const invoice = await tx.vehiclePurchaseInvoice.create({
          data: {
            date: date ? new Date(date) : new Date(),
            invoiceNo,
            invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
            quantity: parseInt(quantity) || 0,
            amount: parseFloat(amount) || 0,
            grossTotal: parseFloat(grossTotal) || 0,
            netAmount: parseFloat(netAmount) || 0,
            roundOff: parseFloat(roundOff) || 0,
            others: parseFloat(others) || 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            purchaseChallan: challan.id,
            createdBy: user
          }
        });
        console.log("Invoice created:", invoice.id);

        // Create Inventory Records
        for (const detail of details) {
          await tx.vehicleInventory.create({
            data: {
              engineNo: detail.engineNo,
              chassisNo: detail.chassisNo,
              keyNo: detail.keyNo,
              batteryNo: detail.batteryNo,
              warrantyBookNo: detail.warrantyBookNo,
              manMonthYear: detail.manMonthYear,
              Status: "Avaliable",
              createdAt: new Date(),
              VehicleMaster: { connect: { id: detail.vehicleId } },
              Branch: { connect: { id: branch } },
              Image: { connect: { id: detail.colorId } },
              VehiclePurchaseInvoice: { connect: { id: invoice.id } }
            }
          });
        }

        return invoice;
      });

      // 5. Increment ID counter
      await IdGenerateController.incrementId("VPI", branch);
      await IdGenerateController.incrementId("VPC", branch);

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "PurchaseInvoice created",
          data: this.transformInvoice(await prisma.vehiclePurchaseInvoice.findUnique({ where: { id: result.id }, include: this.invoiceInclude }))
        }
      });
    } catch (err) {
      logger.error("Create purchase invoice error:", err);
      return res.json({
        code: 500,
        msg: "An error occurred",
        error: err.message,
        err: {
          code: 500,
          message: "Error creating Purchase Invoice",
          err: err.message
        }
      });
    }
  };

  updatePurchaseInvoice = async (req, res) => {
    try {
      const { id } = req.params;
      const {
        date,
        invoiceNo,
        invoiceDate,
        quantity,
        amount,
        grossTotal,
        netAmount,
        roundOff,
        others,
        branch,
        vehicleDetail: selectVehicle,
        supplier,
        supplierInvoiceNo,
        challanData
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const prevInvoice = await prisma.vehiclePurchaseInvoice.findUnique({
        where: { id },
        include: { 
          VehiclePurchaseChallan: { 
            include: { 
              PurchaseChallanHasVehicleDetails: {
                include: { PurchasedVehicleDetail: true }
              } 
            } 
          } 
        }
      });

      if (!prevInvoice) return res.status(404).json({ code: 404, message: "Invoice not found" });

      const prevChallanId = prevInvoice.purchaseChallan;
      const prevDetails = prevInvoice.VehiclePurchaseChallan?.PurchaseChallanHasVehicleDetails.map(junction => junction.PurchasedVehicleDetail) || [];

      const result = await prisma.$transaction(async (tx) => {
        // Update Challan
        await tx.vehiclePurchaseChallan.update({
          where: { id: prevChallanId },
          data: {
            date: challanData?.date ? new Date(challanData.date) : new Date(),
            supplierChallanNo: supplierInvoiceNo,
            supplier: supplier,
            branch: branch
          }
        });

        // Diffing Vehicles
        const prevMap = Object.fromEntries(prevDetails.map(d => [d.chassisNo, d]));
        const newVehicleDetail = selectVehicle.map((item) => ({
          vehicleId: item.vehicle.id,
          chassisNo: item.chassisNo?.toUpperCase(),
          engineNo: item.engineNo?.toUpperCase(),
          keyNo: item.keyNo,
          warrantyBookNo: item.warrantyBookNo,
          colorId: item.color.id,
          batteryNo: item.batteryNo,
          manMonthYear: item.manMonthYear,
          invoiceAmount: parseFloat(item.invoiceAmount) || 0
        }));
        const newMap = Object.fromEntries(newVehicleDetail.map(d => [d.chassisNo, d]));

        // Delete removed
        for (const chassisNo in prevMap) {
          if (!newMap[chassisNo]) {
            const detailToRemove = prevMap[chassisNo];
            await tx.vehicleInventory.deleteMany({ where: { chassisNo, vehiclePurchase: id } });
            await tx.purchaseChallanHasVehicleDetails.deleteMany({ where: { A: prevChallanId, B: detailToRemove.id } });
            await tx.purchasedVehicleDetail.delete({ where: { id: detailToRemove.id } });
          }
        }

        // Add or Update
        for (const chassisNo in newMap) {
          const item = newMap[chassisNo];
          if (!prevMap[chassisNo]) {
            // Create detail
            const detail = await tx.purchasedVehicleDetail.create({
              data: {
                chassisNo: item.chassisNo,
                engineNo: item.engineNo,
                keyNo: item.keyNo,
                warrantyBookNo: item.warrantyBookNo,
                batteryNo: item.batteryNo,
                manMonthYear: item.manMonthYear,
                invoiceAmount: item.invoiceAmount,
                createdAt: new Date(),
                vehicle: { connect: { id: item.vehicleId } },
                color: { connect: { id: item.colorId } }
              }
            });
            // Link detail to challan
            await tx.purchaseChallanHasVehicleDetails.create({
              data: { A: prevChallanId, B: detail.id }
            });

            // Create inventory
            await tx.vehicleInventory.create({
              data: {
                engineNo: item.engineNo,
                chassisNo: item.chassisNo,
                keyNo: item.keyNo,
                batteryNo: item.batteryNo,
                warrantyBookNo: item.warrantyBookNo,
                manMonthYear: item.manMonthYear,
                Status: "Avaliable",
                createdAt: new Date(),
                VehicleMaster: { connect: { id: item.vehicleId } },
                Branch: { connect: { id: branch } },
                Image: { connect: { id: item.colorId } },
                VehiclePurchaseInvoice: { connect: { id: id } }
              }
            });
          } else {
            const prev = prevMap[chassisNo];
            await tx.purchasedVehicleDetail.update({
              where: { id: prev.id },
              data: {
                engineNo: item.engineNo,
                keyNo: item.keyNo,
                warrantyBookNo: item.warrantyBookNo,
                batteryNo: item.batteryNo,
                manMonthYear: item.manMonthYear,
                invoiceAmount: item.invoiceAmount
              }
            });

            await tx.vehicleInventory.updateMany({
              where: { chassisNo, vehiclePurchase: id },
              data: {
                engineNo: item.engineNo,
                chassisNo: item.chassisNo,
                keyNo: item.keyNo,
                batteryNo: item.batteryNo,
                warrantyBookNo: item.warrantyBookNo,
                manMonthYear: item.manMonthYear
              }
            });
          }
        }

        return await tx.vehiclePurchaseInvoice.update({
          where: { id },
          data: {
            date: date ? new Date(date) : new Date(),
            invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
            quantity: parseInt(quantity) || 0,
            amount: parseFloat(amount) || 0,
            grossTotal: parseFloat(grossTotal) || 0,
            netAmount: parseFloat(netAmount) || 0,
            roundOff: parseFloat(roundOff) || 0,
            others: parseFloat(others) || 0
          },
          include: this.invoiceInclude
        });
      });

        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "PurchaseInvoice updated",
            data: this.transformInvoice(result),
            otherValues: result && typeof result === 'object' ? {
              ...result,
              chassisNo: result.chassisNo?.toUpperCase(),
              engineNo: result.engineNo?.toUpperCase()
            } : result
          }
        });
    } catch (err) {
      logger.error("Update purchase invoice error:", err);
      return res.json({ code: 500, msg: "An error occurred", error: err.message });
    }
  };

  deletePurchaseInvoice = async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await prisma.vehiclePurchaseInvoice.findUnique({
        where: { id },
        include: { 
          VehiclePurchaseChallan: { 
            include: { 
              PurchaseChallanHasVehicleDetails: true 
            } 
          } 
        }
      });

      if (!invoice) return res.status(404).json({ code: 404, message: "Not found" });

      const challanId = invoice.purchaseChallan;
      const detailIds = invoice.VehiclePurchaseChallan?.PurchaseChallanHasVehicleDetails.map(j => j.B) || [];

      const transactions = [
        prisma.vehicleInventory.deleteMany({ where: { vehiclePurchase: id } }),
        prisma.vehiclePurchaseInvoice.delete({ where: { id } })
      ];

      if (challanId) {
        transactions.push(prisma.purchaseChallanHasVehicleDetails.deleteMany({ where: { A: challanId } }));
        if (detailIds.length > 0) {
          transactions.push(prisma.purchasedVehicleDetail.deleteMany({ where: { id: { in: detailIds } } }));
        }
        transactions.push(prisma.vehiclePurchaseChallan.delete({ where: { id: challanId } }));
      }

      await prisma.$transaction(transactions);

      return res.json({ code: 200, response: { code: 200, msg: "PurchaseInvoice deleted permanently." } });
    } catch (err) {
      logger.error("Delete purchase invoice error:", err);
      return res.json({ code: 500, msg: "Error deleting PurchaseInvoice", error: err.message });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page = 1, size = 10, searchString, branch } = req.body;
      
      // Priority: branch from body -> branch from token (user.branch)
      let branchIds = [];
      if (branch) {
        branchIds = Array.isArray(branch) ? branch : [branch];
      } else {
        const userBranches = req.user?.branch || [];
        branchIds = Array.isArray(userBranches) ? userBranches : [userBranches];
      }

      const skip = (page - 1) * size;
      const inputValue = searchString || "";

      const where = {
        OR: [
          { invoiceNo: { contains: inputValue, mode: 'insensitive' } },
          { VehiclePurchaseChallan: { supplierChallanNo: { contains: inputValue, mode: 'insensitive' } } },
          { VehiclePurchaseChallan: { Supplier: { name: { contains: inputValue, mode: 'insensitive' } } } }
        ]
      };

      const [invoices, count] = await Promise.all([
        prisma.vehiclePurchaseInvoice.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.invoiceInclude
        }),
        prisma.vehiclePurchaseInvoice.count({ where })
      ]);

      const transformedInvoices = invoices.map(inv => this.transformInvoice(inv));

      return res.json({
        code: 200,
        response: {
          code: 200,
          data: { count, PurchaseInvoice: transformedInvoices }
        }
      });
    } catch (err) {
      logger.error("Get purchase invoice page error:", err);
      return res.json({ code: 500, msg: "Error fetching records", error: err.message });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await prisma.vehiclePurchaseInvoice.findUnique({
        where: { id },
        include: this.invoiceInclude
      });

      if (invoice) {
        return res.json({
          code: 200,
          response: { code: 200, data: this.transformInvoice(invoice) }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one purchase invoice error:", err);
      return res.json({ code: 500, message: "Server error" });
    }
  };

  checkDuplicateInvoiceNo = async (req, res) => {
    try {
      const { invoiceNo, supplierId } = req.body;
      const existing = await prisma.vehiclePurchaseInvoice.findFirst({
        where: {
          VehiclePurchaseChallan: {
            supplierChallanNo: invoiceNo,
            supplier: supplierId
          }
        }
      });

      return res.json({
        code: 200,
        duplicate: !!existing,
        data: existing || null
      });
    } catch (err) {
      logger.error("Check duplicate invoice error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  checkChassisNumber = async (req, res) => {
    try {
      const chassisNo = req.body.chassisNo?.toUpperCase();
      const { manufacturer } = req.body;
      
      const [detail, inventory, sold] = await Promise.all([
        prisma.purchasedVehicleDetail.findFirst({ where: { chassisNo } }),
        prisma.vehicleInventory.findFirst({ where: { chassisNo } }),
        prisma.vehicle.findFirst({ where: { chassisNo } })
      ]);

      let frameDate = null;
      let frameError = null;

      if (manufacturer && chassisNo && chassisNo.length >= 10) {
        const monthChar = chassisNo.charAt(8).toUpperCase();
        const yearChar = chassisNo.charAt(9).toUpperCase();

        try {
          const [monthMatch, yearMatch] = await Promise.all([
            prisma.frameNumber.findFirst({
              where: {
                manufacturerId: manufacturer,
                position: 9,
                inputValue: monthChar
              }
            }),
            prisma.frameNumber.findFirst({
              where: {
                manufacturerId: manufacturer,
                position: 10,
                inputValue: yearChar
              }
            })
          ]);

          if (monthMatch && yearMatch) {
            const dateStr = `${monthMatch.targetValue} ${yearMatch.targetValue}`;
            frameDate = moment(dateStr, 'MMM YYYY').endOf('day').toISOString();
          } else {
            frameError = "Given month and year doesn't exist in frame logic";
          }
        } catch (err) {
          frameError = err.toString();
        }
      }

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "vehicles fetched",
          purchaseInvoice: !!detail,
          inventory: !!inventory,
          soldVehicle: !!sold,
          data: !!(detail || inventory || sold),
          frameDate,
          frameError
        }
      });
    } catch (err) {
      logger.error("Check chassis number error:", err);
      return res.json({ code: 500, msg: "Error checking chassis number" });
    }
  };

  checkEngineNumber = async (req, res) => {
    try {
      const engineNo = req.body.engineNo?.toUpperCase();
      const [detail, inventory, sold] = await Promise.all([
        prisma.purchasedVehicleDetail.findFirst({ where: { engineNo } }),
        prisma.vehicleInventory.findFirst({ where: { engineNo } }),
        prisma.vehicle.findFirst({ where: { engineNo } })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "engine number check complete",
          purchaseInvoice: !!detail,
          inventory: !!inventory,
          soldVehicle: !!sold,
          data: !!(detail || inventory || sold)
        }
      });
    } catch (err) {
      logger.error("Check engine number error:", err);
      return res.json({ code: 500, msg: "Error checking engine number" });
    }
  };

  checkChassisNumberInternal = async (chassisNo, manufacturerId) => {
    const detail = await prisma.purchasedVehicleDetail.findFirst({ where: { chassisNo } });
    const inventory = await prisma.vehicleInventory.findFirst({ where: { chassisNo } });
    const sold = await prisma.vehicle.findFirst({ where: { chassisNo } });
    return { duplicate: !!(detail || inventory || sold) };
  };
}

export default new PurchaseInvoiceController();

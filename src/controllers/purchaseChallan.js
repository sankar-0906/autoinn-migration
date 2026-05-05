import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";
import moment from "moment";

import IdGenerateController from "./idGenerate.js";

/**
 * Controller for Purchase Challan operations.
 * Maintained with 100% payload parity with autoinn-be.
 */
class PurchaseChallanController {
  // Shared include object for PurchaseChallan
  challanInclude = {
    supplier: {
      include: {
        address: { include: { district: true, state: true, country: true } },
        contact: true,
        bank: true
      }
    },
    branch: {
      include: {
        address: { include: { district: true, state: true, country: true } },
        contacts: true
      }
    },
    vehicleDetail: {
      include: {
        vehicle: {
          include: {
            manufacturer: true,
            image: true,
            file: true,
            hsn: true
          }
        },
        color: true
      }
    }
  };

  createPurchaseChallan = async (req, res) => {
    try {
      const {
        date, challanNo, challanDate, supplierChallanNo,
        supplier, branch, vehicleDetail
      } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.purchaseChallan.create({
        data: {
          date: date ? new Date(date) : new Date(),
          challanNo,
          challanDate: challanDate ? new Date(challanDate) : undefined,
          supplierChallanNo,
          createdAt: new Date(),
          updatedAt: new Date(),
          supplier: supplier ? { connect: { id: supplier } } : undefined,
          branch: branch ? { connect: { id: branch } } : undefined,
          createdBy: user ? { connect: { id: user } } : undefined,
          vehicleDetail: vehicleDetail && vehicleDetail.length > 0 ? {
            create: vehicleDetail.map(v => ({
              vehicle: { connect: { id: v.vehicle } },
              chassisNo: v.chassisNo,
              engineNo: v.engineNo,
              keyNo: v.keyNo,
              warrantyBookNo: v.warrantyBookNo,
              batteryNo: v.batteryNo,
              manMonthYear: v.manMonthYear,
              invoiceAmount: parseFloat(v.invoiceAmount) || 0,
              color: v.color ? { connect: { id: v.color } } : undefined,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          } : undefined
        },
        include: this.challanInclude
      });

      // Increment ID counter
      await IdGenerateController.incrementId("VPC", branch);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Purchase Challan created",
          data: created
        }
      });
    } catch (err) {
      logger.error("Create purchase challan error:", err);
      return res.json({ code: 500, msg: "An error occured", error: err.message });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const challan = await prisma.purchaseChallan.findUnique({
        where: { id },
        include: this.challanInclude
      });

      if (challan) {
        return res.json({
          code: 200,
          response: {
            code: 200,
            msg: "Purchase Challan fetched",
            data: challan
          }
        });
      }
      return res.status(404).json({ code: 404, message: "Not found" });
    } catch (err) {
      logger.error("Get one purchase challan error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page = 1, size = 10, searchString } = req.body;
      const branchIds = req.user?.branch || [];
      const skip = (page - 1) * size;
      const inputValue = searchString || "";

      const where = {
        branchId: { in: Array.isArray(branchIds) ? branchIds : [branchIds] },
        OR: [
          { challanNo: { contains: inputValue, mode: 'insensitive' } },
          { supplierChallanNo: { contains: inputValue, mode: 'insensitive' } },
          { supplier: { name: { contains: inputValue, mode: 'insensitive' } } }
        ]
      };

      const [challans, count] = await Promise.all([
        prisma.purchaseChallan.findMany({
          where,
          take: size,
          skip,
          orderBy: { createdAt: 'desc' },
          include: this.challanInclude
        }),
        prisma.purchaseChallan.count({ where })
      ]);

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Purchase Challans fetched",
          data: { count, purchaseChallan: challans }
        }
      });
    } catch (err) {
      logger.error("Get purchase challan page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };

  /**
   * frameNumber endpoint - Validate chassis number and convert to date
   */
  frameNumber = async (req, res) => {
    try {
      const { chassisNo, manufacturer, id, checkType } = req.body;

      // Check for duplicate chassis number in existing sold vehicles
      const existing = await prisma.vehicle.findFirst({
        where: {
          chassisNo,
          id: id ? { not: id } : undefined
        }
      });

      if (existing) {
        return res.json({
          code: 200,
          response: {
            code: 401,
            msg: "Chassis number already exists",
            data: existing.mfg
          }
        });
      }

      let otherValues = {};
      if (!checkType) {
        const vehicle = await prisma.vehicle.findFirst({
          where: { chassisNo }
        });

        if (!vehicle) {
          otherValues = "NO DATA FOUND FOR THIS CHASSIS NUMBER IN OUR SYSTEM";
        } else {
          otherValues = {
            id: vehicle.id,
            engineNo: vehicle.engineNo,
            modelCode: vehicle.vehicleMasterId,
            dateOfSale: vehicle.dateOfSale,
            color: vehicle.colorId
          };
        }
      }

      // Extract month/year codes from chassisNo (Legacy logic)
      if (!chassisNo || chassisNo.length < 10) {
        return res.json({
          code: 200,
          response: {
            code: 400,
            msg: "Enter Valid Chassis Number"
          }
        });
      }

      let temp = chassisNo.slice(8, 10);
      let first = temp.slice(0, 1).toUpperCase();
      let last = temp.slice(1).toUpperCase();

      const [month, year] = await Promise.all([
        prisma.frameNumber.findFirst({
          where: { manufacturerId: manufacturer, position: 9, inputValue: first }
        }),
        prisma.frameNumber.findFirst({
          where: { manufacturerId: manufacturer, position: 10, inputValue: last }
        })
      ]);

      if (month && year) {
        const monthVal = month.targetValue;
        const yearVal = year.targetValue;
        let date = monthVal + " " + yearVal;
        const formattedDate = moment(date, 'MMM YYYY').endOf('day').toISOString();
        
        return res.json({
          code: 200,
          response: {
            code: 200,
            msg: "Date converted",
            data: formattedDate,
            otherValues
          }
        });
      }

      return res.json({
        code: 200,
        response: {
          code: 400,
          msg: "given month and year doesn't exist in frame logic"
        }
      });
    } catch (err) {
      logger.error("Frame number check error:", err);
      return res.json({ code: 500, msg: "error getting frameNumber" });
    }
  };

  /**
   * engineNumber endpoint - Validate engine number
   */
  engineNumber = async (req, res) => {
    try {
      const { engineNo, manufacturer, id } = req.body;

      const existing = await prisma.vehicle.findFirst({
        where: { engineNo, id: id ? { not: id } : undefined }
      });

      if (existing) {
        return res.json({
          code: 200,
          response: {
            code: 401,
            msg: "Engine number already exists"
          }
        });
      }

      let otherValues = {};
      const vehicle = await prisma.vehicle.findFirst({
        where: { engineNo }
      });

      if (!vehicle) {
        otherValues = "NO DATA FOUND FOR THIS ENGINE NUMBER IN OUR SYSTEM";
      } else {
        otherValues = {
          id: vehicle.id,
          chassisNo: vehicle.chassisNo,
          modelCode: vehicle.vehicleMasterId,
          dateOfSale: vehicle.dateOfSale,
          color: vehicle.colorId
        };
      }

      return res.json({
        code: 200,
        response: {
          code: 200,
          msg: "Engine number check complete",
          otherValues
        }
      });
    } catch (err) {
      logger.error("Engine number check error:", err);
      return res.json({ code: 500, msg: "error getting engineNumber" });
    }
  };
}

export default new PurchaseChallanController();

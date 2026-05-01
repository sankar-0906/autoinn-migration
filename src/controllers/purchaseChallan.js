import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import titleCase from "../utils/string.util.js";
import moment from "moment";

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

      return res.json({
        code: 200,
        response: created
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
          response: challan
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
      const { page, size, searchString } = req.body;
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
        response: { count, purchaseChallan: challans }
      });
    } catch (err) {
      logger.error("Get purchase challan page error:", err);
      return res.json({ code: 500, msg: "an error occurred" });
    }
  };
}

export default new PurchaseChallanController();

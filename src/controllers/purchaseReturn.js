import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";

/**
 * Controller for Purchase Returns (Vehicles).
 */
class PurchaseReturnController {
  getPage = async (req, res) => {
    try {
      const { page = 1, size = 10 } = req.body;
      const skip = (parseInt(page) - 1) * parseInt(size);
      const take = parseInt(size);

      const [returns, count] = await Promise.all([
        prisma.vehiclePurchaseReturn.findMany({
          skip,
          take,
          include: {
            purchaseInvoice: true,
            purchaseChallan: true,
            createdBy: { select: { EmployeeProfile_User_profileToEmployeeProfile: { select: { employeeName: true } } } }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.vehiclePurchaseReturn.count()
      ]);

      return res.json({
        code: 200,
        response: { count, returns }
      });
    } catch (err) {
      logger.error("Purchase return getPage error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getOne = async (req, res) => {
    try {
      const { id } = req.params;
      const purchaseReturn = await prisma.vehiclePurchaseReturn.findUnique({
        where: { id },
        include: {
          purchaseInvoice: true,
          purchaseChallan: true,
          PurchasedVehicleDetailToVehiclePurchaseReturn: {
            include: { PurchasedVehicleDetail: true }
          }
        }
      });
      return res.json({
        code: 200,
        response: purchaseReturn
      });
    } catch (err) {
      logger.error("Purchase return getOne error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };
}

export default new PurchaseReturnController();

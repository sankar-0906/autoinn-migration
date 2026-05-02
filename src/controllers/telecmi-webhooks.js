import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";

/**
 * Controller for TeleCMI Telephony integrations.
 * Handles incoming/outgoing call logging and call history.
 */
class TeleCMIController {
  getPhoneDialHistory = async (req, res) => {
    try {
      const { direction, status, fromDate, toDate, limit, offset } = req.body;

      const history = await prisma.teleCMICallHistory.findMany({
        where: {
          direction: direction || undefined,
          status: status || undefined,
          createdAt: {
            gte: fromDate ? new Date(fromDate) : undefined,
            lte: toDate ? new Date(toDate) : undefined
          }
        },
        take: parseInt(limit) || 50,
        skip: parseInt(offset) || 0,
        orderBy: { updatedAt: 'desc' }
      });

      return res.json({
        code: 200,
        data: history
      });
    } catch (err) {
      logger.error("Get phone dial history error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getCallHistoryForNumber = async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const { direction, status, fromDate, toDate, limit, offset } = req.body;

      const history = await prisma.teleCMICallHistory.findMany({
        where: {
          OR: [
            { from: { contains: phoneNumber } },
            { to: { contains: phoneNumber } }
          ],
          direction: direction || undefined,
          status: status || undefined,
          createdAt: {
            gte: fromDate ? new Date(fromDate) : undefined,
            lte: toDate ? new Date(toDate) : undefined
          }
        },
        take: parseInt(limit) || 50,
        skip: parseInt(offset) || 0,
        orderBy: { updatedAt: 'desc' }
      });

      return res.json({
        code: 200,
        data: history
      });
    } catch (err) {
      logger.error("Get call history error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getAllTeleUsers = async (req, res) => {
    try {
      const users = await prisma.teleCMIUserStatus.findMany();
      return res.json({
        code: 200,
        msg: "Fetched all users",
        data: users
      });
    } catch (err) {
      logger.error("Get all tele users error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  createUser = async (req, res) => {
    try {
      const { name, phone, extension, teleCMIUserID } = req.body;
      const created = await prisma.teleCMIUserStatus.create({
        data: {
          teleCMIUserID: teleCMIUserID || extension || phone,
          teleCMIUserName: name,
          status: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      return res.json({
        code: 200,
        data: created
      });
    } catch (err) {
      logger.error("Create tele user error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  updateStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const user = await prisma.teleCMIUserStatus.findUnique({ where: { id } });
      if (!user) return res.json({ code: 404, msg: "User not found" });

      const updated = await prisma.teleCMIUserStatus.update({
        where: { id },
        data: { status: !user.status, updatedAt: new Date() }
      });

      return res.json({
        code: 200,
        msg: "Status toggled successfully",
        data: updated
      });
    } catch (err) {
      logger.error("Update tele user status error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  deleteTeleUser = async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.teleCMIUserStatus.delete({ where: { id } });
      return res.json({ code: 200, msg: "User deleted" });
    } catch (err) {
      logger.error("Delete tele user error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };
}

export default new TeleCMIController();

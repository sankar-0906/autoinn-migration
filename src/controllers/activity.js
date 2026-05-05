import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";

class ActivityController {
  getAllActivitiesByCustomerIDs = async (req, res) => {
    try {
      const { ids, limit = 15, offset = 0 } = req.body;
      
      const activities = await prisma.activity.findMany({
        where: {
          customerId: { in: ids }
        },
        take: parseInt(limit) || 15,
        skip: parseInt(offset) || 0,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: true,
          callHistory: true,
          sms: true
        }
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Activities fetched successfully",
          data: activities
        }
      });
    } catch (err) {
      logger.error("Get activities by customer ids error:", err);
      return res.json({ code: 500, message: "Server error, Please check the logs" });
    }
  };
}

export default new ActivityController();

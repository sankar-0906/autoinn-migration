import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import moment from "moment";


class SmsController {
  /**
   * Helper to format SmsTemplate to match legacy structure
   */
  formatSms = (s) => {
    if (!s) return s;
    return {
      ...s,
      activity: s.name, // Legacy parity
      description: s.text // Legacy parity
    };
  };

  createSms = async (req, res) => {
    try {
      const { activity, description } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.smsTemplate.create({
        data: {
          name: activity,
          text: description,
          createdAt: new Date(),
          User: user ? { connect: { id: user } } : undefined
        }
      });

      return res.json({
        code: 200,
        message: "Sms template created successfully",
        data: this.formatSms(created),
        response: {
          code: 200,
          data: this.formatSms(created)
        }
      });
    } catch (err) {
      logger.error("CONTROLLER.SMS.create", err);
      return res.json({ code: 500, msg: "error creating sms", error: err.message });
    }
  };

  smsReport = async (req, res) => {
    try {
      const data = req.method === "GET" ? req.query : req.body;
      const { sid, dest, stime, dtime, status, reason } = data;
      const sendTime = moment(stime).toDate();
      const delTime = dtime ? moment(dtime).toDate() : null;

      const response = await prisma.smsCallBack.create({
        data: {
          senderId: sid ? sid.toString() : null,
          destination: dest ? dest.toString() : null,
          sentTime: sendTime,
          deliveredTime: delTime,
          status: status ? status.toString() : null,
          reason: reason ? reason.toString() : null,
          createdAt: new Date()
        }
      });

      const messageId = response.senderId;
      let phone = dest ? (dest.length === 10 ? dest : dest.slice(2)) : null;

      if (phone) {
        const histories = await prisma.smsHistory.findMany({
          where: {
            messageId: messageId.toString(),
            phone: phone
          }
        });

        if (histories.length > 0) {
          await prisma.smsHistory.update({
            where: { id: histories[0].id },
            data: {
              smsStatus: reason,
              smsDeliveredTime: delTime
            }
          });
        }

        const customerPhones = await prisma.customerPhone.findMany({
          where: { phone: phone }
        });

        if (customerPhones.length > 0) {
          await prisma.customerPhone.update({
            where: { id: customerPhones[0].id },
            data: {
              valid: status === "001",
              DND: status === "004"
            }
          });
        }
      }

      return res.json({
        code: 200,
        msg: "SMS Call Back created",
        data: response
      });
    } catch (err) {
      logger.error("CONTROLLER.SMS.report", err);
      return res.json({ code: 500, msg: "error creating sms call back", error: err.message });
    }
  };

  updateSms = async (req, res) => {
    try {
      const { id } = req.params;
      const { activity, description } = req.body;

      const updated = await prisma.smsTemplate.update({
        where: { id },
        data: {
          name: activity,
          text: description
        }
      });

      return res.json({
        code: 200,
        message: "sms template updated",
        data: this.formatSms(updated),
        response: {
          code: 200,
          data: this.formatSms(updated)
        }
      });
    } catch (err) {
      logger.error("CONTROLLER.SMS.update", err);
      return res.json({ code: 500, msg: "error updating sms", error: err.message });
    }
  };

  deleteSms = async (req, res) => {
    try {
      const { id, type } = req.params;
      if (type === "SOFT") {
        return res.json({ code: 200, message: "Soft delete not implemented" });
      } else {
        await prisma.smsTemplate.delete({ where: { id } });
        return res.json({
          code: 200,
          response: {
            code: 200,
            message: "deleted sms template permanently"
          }
        });
      }
    } catch (err) {
      logger.error("CONTROLLER.SMS.delete", err);
      return res.json({ code: 500, msg: "error deleting Sms", error: err.message });
    }
  };

  getAll = async (req, res) => {
    try {
      const templates = await prisma.smsTemplate.findMany({
        orderBy: { createdAt: 'desc' }
      });
      const formatted = templates.map(t => this.formatSms(t));
      return res.json({
        code: 200,
        response: {
          code: 200,
          data: formatted
        }
      });
    } catch (err) {
      logger.error("CONTROLLER.SMS.getAll", err);
      return res.json({ code: 500, msg: "error getting all sms", error: err.message });
    }
  };

  getPage = async (req, res) => {
    try {
      const { page, size, searchString } = req.body;
      const parsedPage = parseInt(page) || 1;
      const parsedSize = parseInt(size) || 10;
      const skip = (parsedPage - 1) * parsedSize;

      const where = searchString ? {
        OR: [
          { name: { contains: searchString, mode: 'insensitive' } },
          { text: { contains: searchString, mode: 'insensitive' } }
        ]
      } : {};

      const [templates, count] = await Promise.all([
        prisma.smsTemplate.findMany({
          where,
          take: parsedSize,
          skip,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.smsTemplate.count({ where })
      ]);

      const formatted = templates.map(t => this.formatSms(t));
      return res.json({
        code: 200,
        response: {
          code: 200,
          data: formatted,
          count
        }
      });
    } catch (err) {
      logger.error("CONTROLLER.SMS.getPage", err);
      return res.json({ code: 500, msg: "error getting sms page", error: err.message });
    }
  };

  createTemplate = async (req, res) => {
    try {
      const { name, text } = req.body;
      const user = req.user?.id || req.headers["user-id"];

      const created = await prisma.smsTemplate.create({
        data: {
          name,
          text,
          createdAt: new Date(),
          User: user ? { connect: { id: user } } : undefined
        }
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Template created successfuly",
          data: this.formatSms(created)
        }
      });
    } catch (err) {
      logger.error("CONTROLLER.SMS.createTemplate", err);
      return res.json({ code: 500, msg: "error creating template", error: err.message });
    }
  };

  updateTemplate = async (req, res) => {
    try {
      const { id } = req.params;
      const { name, text, status } = req.body;

      const updated = await prisma.smsTemplate.update({
        where: { id },
        data: {
          name,
          text,
          status,
          updatedAt: new Date()
        }
      });

      return res.json({
        code: 200,
        response: {
          code: 200,
          message: "Template updated successfuly",
          data: this.formatSms(updated)
        }
      });
    } catch (err) {
      logger.error("CONTROLLER.SMS.updateTemplate", err);
      return res.json({ code: 500, msg: "error updating template", error: err.message });
    }
  };
}

export default new SmsController();

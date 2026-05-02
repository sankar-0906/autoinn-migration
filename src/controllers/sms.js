import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import moment from "moment";


class SmsController {
  constructor() {}

  createSms = async (data, user) => {
    try {
      const { activity, description } = data;
      // Note: Legacy calls this.db.createSms but model name seems to be SmsTemplate or similar
      // We will use SmsTemplate here.
      const created = await prisma.smsTemplate.create({
        data: {
          name: activity,
          text: description,
          createdAt: new Date(),
          User: user ? { connect: { id: user } } : undefined
        }
      });
      return {
        code: 200,
        message: "Sms template created successfully",
        data: created,
      };
    } catch (err) {
      logger.error("CONTROLLER.SMS.create", err);
      throw { code: 500, message: "error creating sms", data: err };
    }
  };

  smsReport = async (data) => {
    try {
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
      let phone = dest.length === 10 ? dest : dest.slice(2);

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

      return {
        code: 200,
        msg: "SMS Call Back created",
        data: response
      };
    } catch (err) {
      logger.error("CONTROLLER.SMS.report", err);
      throw { code: 500, message: "error creating sms call back", data: err };
    }
  };

  updateSms = async (id, data, user) => {
    try {
      const { activity, description } = data;
      const updated = await prisma.smsTemplate.update({
        where: { id },
        data: {
          name: activity,
          text: description
        }
      });
      return {
        code: 200,
        message: "sms template updated",
        data: updated,
      };
    } catch (err) {
      logger.error("CONTROLLER.SMS.update", err);
      throw { code: 500, message: "error updating sms", data: err };
    }
  };

  deleteSms = async (id, type, user) => {
    try {
      if (type === "SOFT") {
        // Soft delete not in schema for SmsTemplate
        return { code: 200, message: "Soft delete not implemented" };
      } else {
        await prisma.smsTemplate.delete({ where: { id } });
        return {
          code: 200,
          message: "deleted sms template permanently",
        };
      }
    } catch (err) {
      logger.error("CONTROLLER.SMS.delete", err);
      throw { code: 500, message: "error deleting Sms", data: err };
    }
  };

  createTemplate = async (id, data, user) => {
    // This method in legacy was adding a template to an Sms model.
    // Since we are using SmsTemplate directly, this might be redundant or different.
    // Actually legacy code was adding a NEW SmsTemplate linked to an Sms.
    // For now, I'll map it to updating the existing SmsTemplate or similar.
    return { code: 200, message: "createTemplate not fully mapped due to schema mismatch" };
  };

  getAll = async () => {
    try {
      const templates = await prisma.smsTemplate.findMany();
      return {
        code: 200,
        message: "Sms templates fetched",
        data: templates,
      };
    } catch (err) {
      logger.error("CONTROLLER.SMS.getAll", err);
      throw { code: 500, message: "error getting all sms", data: err };
    }
  };
}

export default new SmsController();

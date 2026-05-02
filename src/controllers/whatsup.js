import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import axios from "axios";


class WhatsappController {
  constructor() {
    this.whatsappUid = process.env.WHATSAPP_UID;
    this.whatsappPassword = process.env.WHATSAPP_PASSWORD;
    this.whatsappAccountUid = process.env.WHATSAPP_ACCOUNT_UID;
    this.whatsappSource = process.env.WHATSAPP_SOURCE;
  }

  getAll = async () => {
    try {
      const templates = await prisma.whatsappTemplate.findMany();
      return {
        code: 200,
        message: "Whatsapp Template fetched successfully",
        data: templates,
      };
    } catch (err) {
      logger.error("CONTROLLER.WHATSAPP.getAll", err);
      throw { code: 500, message: "error getting Whatsapp Templates", data: err };
    }
  };

  checkStatus = async (uid) => {
    try {
      const response = await axios.get(`https://api.karix.io/whatsapp/template/${uid}`, {
        params: { 'api-version': '2.0' },
        auth: {
          username: this.whatsappUid,
          password: this.whatsappPassword,
        },
      });
      if (response.status === 200 && response.data.data) {
        return { status: response.data.data.status };
      }
      return { status: "unknown" };
    } catch (err) {
      logger.error("CONTROLLER.WHATSAPP.checkStatus", err);
      throw { code: 500, message: "Error checking template status" };
    }
  };

  createTemplate = async (data) => {
    try {
      const { name, text, legends, module, submodule } = data;
      // Karix API call logic would go here if needed for dynamic creation
      const created = await prisma.whatsappTemplate.create({
        data: {
          name,
          text: text.replace(/\n/g, ""),
          legends,
          module,
          submodule,
          status: "pending",
          createdAt: new Date()
        }
      });
      return { code: 200, message: "Whatsapp Template created", data: created };
    } catch (err) {
      logger.error("CONTROLLER.WHATSAPP.createTemplate", err);
      throw { code: 500, message: "error creating template" };
    }
  };

  updateTemplate = async (id, data) => {
    try {
      const { name, text, legends, module, submodule, status } = data;
      const updated = await prisma.whatsappTemplate.update({
        where: { id },
        data: {
          name,
          text: text.replace(/\n/g, ""),
          legends,
          module,
          submodule,
          status: status || "pending",
          updatedAt: new Date()
        }
      });
      return { code: 200, message: "Whatsapp Template updated", data: updated };
    } catch (err) {
      logger.error("CONTROLLER.WHATSAPP.updateTemplate", err);
      throw { code: 500, message: "error updating template" };
    }
  };

  deleteTemplate = async (id) => {
    try {
      await prisma.whatsappTemplate.delete({ where: { id } });
      return { code: 200, message: "Whatsapp Template deleted" };
    } catch (err) {
      logger.error("CONTROLLER.WHATSAPP.deleteTemplate", err);
      throw { code: 500, message: "error deleting template" };
    }
  };

  getChatList = async () => {
    try {
      const data = await prisma.whatsappChat.findMany({
        orderBy: { updatedAt: "desc" }
      });
      const update1 = data.filter(i => i.notification === true);
      const update2 = data.filter(i => i.notification !== true);
      const merge = update1.concat(update2);
      return { code: 200, data: merge };
    } catch (err) {
      logger.error("CONTROLLER.WHATSAPP.getChatList", err);
      throw { code: 500, message: "Error fetching chat list" };
    }
  };

  getChatMessage = async (id) => {
    try {
      const data = await prisma.whatsappChat.findUnique({
        where: { id },
        include: { text: true }
      });
      await this.clearNotificationCount(id);
      return { code: 200, data };
    } catch (err) {
      logger.error("CONTROLLER.WHATSAPP.getChatMessage", err);
      throw { code: 500, message: "Error fetching chat message" };
    }
  };

  clearNotificationCount = async (id) => {
    try {
      await prisma.whatsappChat.update({
        where: { id },
        data: { notification: false, count: 0 }
      });
    } catch (err) {
      logger.error("CONTROLLER.WHATSAPP.clearNotificationCount", err);
    }
  };

  fetchProfileByNumber = async () => {
    try {
      const phone = this.whatsappSource.replace("+", "");
      const response = await axios.get(`https://api.karix.io/whatsapp/profile/business/${phone}/`, {
        params: { 'api-version': '2.0' },
        auth: {
          username: this.whatsappUid,
          password: this.whatsappPassword,
        },
      });
      if (response.status === 200) {
        const profilePicture = await this.fetchProfilePicture(phone);
        const responseData = response.data.data;
        if (profilePicture && profilePicture.data && profilePicture.data.data) {
          responseData["image"] = profilePicture.data.data["url"];
        }
        return { code: 200, data: responseData };
      }
    } catch (err) {
      logger.error("CONTROLLER.WHATSAPP.fetchProfileByNumber", err);
      throw { code: 500, message: "Error fetching profile" };
    }
  };

  fetchProfilePicture = async (phone) => {
    try {
      const response = await axios.get(`https://api.karix.io/whatsapp/profile/photo/${phone}/`, {
        params: { 'api-version': '2.0' },
        auth: {
          username: this.whatsappUid,
          password: this.whatsappPassword,
        },
      });
      if (response.status === 200) {
        return { code: 200, data: response.data };
      }
    } catch (err) {
      logger.error("CONTROLLER.WHATSAPP.fetchProfilePicture", err);
      return null;
    }
  };
}

export default new WhatsappController();

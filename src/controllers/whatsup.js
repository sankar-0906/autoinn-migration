import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";

/**
 * Controller for WhatsApp messaging and templates.
 */
class WhatsappController {
  getAll = async (req, res) => {
    try {
      const templates = await prisma.whatsappTemplate.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return res.json({
        code: 200,
        response: templates
      });
    } catch (err) {
      logger.error("WhatsApp templates error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getChatList = async (req, res) => {
    try {
      const chats = await prisma.whatsappChat.findMany({
        include: {
          WhatsappMessageList: {
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });
      return res.json({
        code: 200,
        msg: chats
      });
    } catch (err) {
      logger.error("WhatsApp chat list error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  getChatMessage = async (req, res) => {
    try {
      const { id } = req.params;
      const chat = await prisma.whatsappChat.findUnique({
        where: { id },
        include: {
          WhatsappMessageList: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });
      return res.json({
        code: 200,
        msg: chat
      });
    } catch (err) {
      logger.error("WhatsApp chat message error:", err);
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };

  fetchProfileByNumber = async (req, res) => {
    try {
      // Mocking profile fetch logic
      return res.json({
        code: 200,
        response: { name: "Business Profile", about: "AutoInn Service" }
      });
    } catch (err) {
      return res.json({ code: 500, msg: "An error occurred" });
    }
  };
}

export default new WhatsappController();

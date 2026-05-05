import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import axios from "axios";
import TinyURL from "tinyurl";
import moment from "moment";
import idGenerateController from "./idGenerate.js";


class SendSmsController {
  constructor() {
    this.whatsAppApi = "https://api.karix.io/message/";
    this.smsApi = "https://japi.instaalerts.zone/httpapi/QueryStringReceiver";
    this.adminApiKey = process.env.ADMIN_API_KEY;
  }

  shorten = (url) => {
    return new Promise((resolve, reject) => {
      try {
        TinyURL.shorten(url, (res, err) => {
          if (res) resolve(res);
          else resolve(url); // Fallback to original URL on error
        });
      } catch (error) {
        resolve(url);
      }
    });
  };

  sendSms = async (data) => {
    try {
      const response = await axios.post("http://admin.autocloud.in/api/v1/smsApi/sendSms", data, {
        headers: { 'Authorization': this.adminApiKey }
      });
      return response;
    } catch (error) {
      logger.error("SENDSMS.external", error);
      throw { code: 500, message: "Failed in Sending sms" };
    }
  };

  sendWhatsApp = async (data) => {
    try {
      const response = await axios.post("http://admin.autocloud.in/api/v1/smsApi/sendWhatsAppSms", data, {
        headers: { 'Authorization': this.adminApiKey }
      });
      return response;
    } catch (error) {
      logger.error("SENDWHATSAPP.external", error);
      throw error;
    }
  };

  quotationSms = async (data, user, branch) => {
    try {
      let { cname, qtno, vname, slex, link, dlr, phone, customerId, type, branchId, gmLink } = data;

      const quotation = await prisma.quotation.findFirst({
        where: { quotationId: qtno }
      });

      if (!cname && quotation) {
        cname = quotation.customerName;
      }

      let getSms;
      if (type === "SMS") {
        getSms = await prisma.smsTemplate.findMany({
          where: { submodule: "Quotation Generation SMS" },
        });
      } else if (type === "WhatsApp" || type === "WhatsAppPreview") {
        getSms = await prisma.whatsappTemplate.findMany({
          where: { submodule: "Quotation Generation SMS" },
        });
      }

      if (!getSms || getSms.length === 0) {
        return { code: 400, message: "Template not found for Quotation" };
      }

      let temp = getSms[0].text;
      // Note: Legacy used eval for template literal interpolation.
      // We should ideally use a safer template engine, but for parity:
      let template = "";
      try {
        // Safe-ish eval alternative for simple variable interpolation
        const func = new Function("qtno", "cname", "vname", "slex", "dlr", "link", "gmLink", `return \`${temp}\`;`);
        template = func(qtno, cname, vname, slex, dlr, link, gmLink);
      } catch (e) {
        template = temp;
      }

      if (type === "WhatsAppPreview") {
        return {
          code: 200,
          message: "Quotation whatsapp template preview",
          data: { previewMessage: template },
        };
      }

      const payload = { phone, text: template };

      if (type === "SMS") {
        const sendRes = await this.sendSms(payload);
        if (sendRes.status === 200) {
          const messageId = sendRes.data.messageId;
          if (quotation) {
            await prisma.quotation.update({
              where: { id: quotation.id },
              data: {
                sms: {
                  create: {
                    module: "Quotation",
                    phone: phone,
                    smsText: template,
                    messageId: messageId ? messageId.toString() : null,
                    createdAt: new Date()
                  }
                },
                sentStatus: true
              }
            });
          }

          const activityId = await idGenerateController.activity({});
          await prisma.customer.update({
            where: { id: customerId },
            data: {
              activity: {
                create: {
                  activityId: activityId.data,
                  interactionType: "Message",
                  remarks: template,
                  createdBy: user ? { connect: { id: user } } : undefined,
                  createdAt: new Date()
                }
              }
            }
          });

          return { code: 200, message: "Quotation sms sent", data: sendRes.data.response };
        }
      } else if (type === "WhatsApp") {
        const sendRes = await this.sendWhatsApp(payload);
        if (sendRes.status === 200 && sendRes.data.status === 200) {
          if (sendRes.data.response.objects[0].error === null) {
            const messageId = sendRes.data.response.objects[0].uid;
            
            // Update customer phone for WhatsApp validity
            const customer = await prisma.customer.findUnique({
              where: { id: customerId },
              include: { contacts: true }
            });
            if (customer && customer.contacts.length > 0) {
              await prisma.customerPhone.update({
                where: { id: customer.contacts[0].id },
                data: { WhatsApp: true }
              });
            }

            if (quotation) {
              await prisma.quotation.update({
                where: { id: quotation.id },
                data: {
                  sms: {
                    create: {
                      module: "Quotation",
                      phone: phone,
                      smsText: template,
                      whatsAppId: messageId ? messageId.toString() : null,
                      whatsAppSmsStatus: "true",
                      createdAt: new Date()
                    }
                  },
                  sentWhatsApp: true
                }
              });
            }

            const activityId = await idGenerateController.activity({});
            await prisma.customer.update({
              where: { id: customerId },
              data: {
                activity: {
                  create: {
                    activityId: activityId.data,
                    interactionType: "WhatsApp Message",
                    phone: phone,
                    sentWhatsApp: true,
                    remarks: template,
                    createdBy: user ? { connect: { id: user } } : undefined,
                    createdAt: new Date()
                  }
                }
              }
            });

            return { code: 200, message: "Quotation sms sent", data: sendRes.data.response };
          } else {
            return { code: 400, message: 'Whatsapp Contact does not exist' };
          }
        }
      }
      return { code: 500, message: "An error occurred" };
    } catch (err) {
      logger.error("CONTROLLER.SendSMS.quotation", err);
      throw { code: 500, message: "error sending sms", data: err };
    }
  };

  testSms = async (data) => {
    try {
      const { phone, sms } = data;
      const payload = { phone, text: sms };
      const sendRes = await this.sendSms(payload);
      if (sendRes.status === 200) {
        return { code: 200, message: "Test sms sent", data: sendRes.data.response };
      }
      return { code: 500, message: "An error occurred" };
    } catch (err) {
      logger.error("CONTROLLER.SendSMS.test", err);
      throw { code: 500, message: "error sending test sms", data: err };
    }
  };
}

export default new SendSmsController();

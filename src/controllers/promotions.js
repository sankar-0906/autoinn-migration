import prisma from "../config/prisma.config.js";
import logger from "../config/logger.config.js";
import moment from "moment";


import IdGenerateController from "./idGenerate.js";


class PromotionsController {
  constructor() {}

  createTask = async (data, user) => {
    try {
      const {
        taskId,
        executionDate,
        executionTime,
        group,
        message: { promotionName, sms, legends },
        senderId,
        status,
        start
      } = data;

      let execDate;
      if (!start) {
        const edate = moment(executionDate).format("DD-MM-YYYY");
        const etime = moment(executionTime).format("HH:mm");
        execDate = moment(edate + " " + etime, "DD-MM-YYYY HH:mm").toDate();
      } else {
        execDate = new Date();
      }

      const task = await prisma.task.create({
        data: {
          taskId,
          executionTime: execDate,
          group: { connect: { id: group } },
          message: {
            create: {
              promotionName,
              sms,
              legends,
              createdBy: user ? { connect: { id: user } } : undefined,
              createdAt: new Date()
            }
          },
          senderId,
          status,
          createdBy: user ? { connect: { id: user } } : undefined,
          createdAt: new Date()
        }
      });

      // Increment ID counter
      await IdGenerateController.incrementId("PROMOTIONS", data.branch || null);

      return {
        code: 200,
        message: "Task created",
        data: task,
      };
    } catch (err) {
      logger.error("CONTROLLER.PROMOTIONS.createTask", err);
      throw { code: 500, message: "error creating task", data: err };
    }
  };

  createGroup = async (data, user) => {
    try {
      const {
        groupName,
        filters: {
          model,
          allModel,
          from,
          to,
          gender,
          allGender,
          leadStage,
          allLeadStage,
          fromAge,
          toAge,
          customerType,
          allCustomerType,
          customerGrouping,
          allCustomerGrouping,
        },
      } = data;

      const group = await prisma.group.create({
        data: {
          groupName,
          filters: {
            create: {
              model,
              allModel,
              from: from ? new Date(from) : null,
              to: to ? new Date(to) : null,
              gender,
              allGender,
              leadStage,
              allLeadStage,
              fromAge,
              toAge,
              customerType,
              allCustomerType,
              customerGrouping,
              allCustomerGrouping,
              createdAt: new Date()
            }
          },
          createdBy: user ? { connect: { id: user } } : undefined,
          createdAt: new Date()
        }
      });

      return {
        code: 200,
        msg: "group created",
        data: group,
      };
    } catch (err) {
      logger.error("CONTROLLER.PROMOTIONS.createGroup", err);
      throw { code: 500, message: "error creating group", data: err };
    }
  };

  getAllTasks = async () => {
    try {
      const tasks = await prisma.task.findMany({
        include: {
          group: true,
          message: true
        }
      });
      return {
        code: 200,
        message: "Tasks fetched",
        data: tasks,
      };
    } catch (err) {
      logger.error("CONTROLLER.PROMOTIONS.getAllTasks", err);
      throw { code: 500, message: "error getting all Tasks", data: err };
    }
  };

  getAllGroups = async () => {
    try {
      const groups = await prisma.group.findMany({
        include: { filters: true }
      });
      return {
        code: 200,
        message: "Groups fetched",
        data: groups,
      };
    } catch (err) {
      logger.error("CONTROLLER.PROMOTIONS.getAllGroups", err);
      throw { code: 500, message: "error getting all groups", data: err };
    }
  };
}

export default new PromotionsController();

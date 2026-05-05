import { Server } from "socket.io";
import JWT from "../services/jwt.service.js";
import prisma from "./prisma.config.js";
import logger from "./logger.config.js";

let ioInstance = null;
let globalFullUserList = [];
const activeUserIds = new Set();
const userSocketCountMap = new Map();

export const setIO = (io) => {
  ioInstance = io;
  logger.info("Socket.io instance initialized.");
};

export const getIO = () => {
  return ioInstance;
};

export const broadcastStatusUpdate = () => {
  if (!ioInstance) return;
  ioInstance.emit("teleUserStatus", { type: "teleUserStatus", data: globalFullUserList });
};

export const broadcastMissedCallNotification = (callData) => {
  if (!ioInstance) return;
  ioInstance.emit("missedCallNotification", {
    type: "missedCallNotification",
    data: callData,
    timestamp: new Date().toISOString()
  });
};

export const broadcastEstimateUpdate = (data) => {
  if (!ioInstance) return;
  ioInstance.emit("estimateUpdate", {
    type: "estimateUpdate",
    data: data,
    timestamp: new Date().toISOString()
  });
};

const incrementUserConnection = (userId) => {
  const count = userSocketCountMap.get(userId) || 0;
  userSocketCountMap.set(userId, count + 1);
  activeUserIds.add(userId);
};

const decrementUserConnection = (userId) => {
  const count = userSocketCountMap.get(userId) || 0;
  if (count <= 1) {
    userSocketCountMap.delete(userId);
    activeUserIds.delete(userId);
    return 0;
  } else {
    userSocketCountMap.set(userId, count - 1);
    return count - 1;
  }
};

export const fetchAndBroadcast = async () => {
  try {
    // Simplified fetch for teleuser status parity
    const teleUsers = await prisma.teleCMIUserStatus?.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        activeUser: {
          include: { 
            EmployeeProfile_User_profileToEmployeeProfile: true 
          }
        }
      }
    }) || [];

    globalFullUserList = teleUsers.map(t => ({
      id: t.id,
      teleCMIUserID: t.teleCMIUserID,
      teleCMIUserName: t.teleCMIUserName,
      status: t.status,
      userName: t.activeUser?.EmployeeProfile_User_profileToEmployeeProfile?.employeeName,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }));
    
    broadcastStatusUpdate();
  } catch (err) {
    logger.error("Fetch and broadcast error:", err);
  }
};

export const setupTeleCMISocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
  });
  setIO(io);

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error("No token provided"));

    try {
      const decoded = JWT.verify(token);
      if (!decoded || !decoded.id) return next(new Error("Invalid token"));
      socket.userId = decoded.id;
      return next();
    } catch (err) {
      return next(new Error("Token decode error"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;
    incrementUserConnection(userId);
    logger.info(`🟢 User ${userId} connected - Tabs:${userSocketCountMap.get(userId)} | Active users: ${activeUserIds.size}`);

    socket.on("disconnect", async () => {
      const remaining = decrementUserConnection(userId);
      logger.info(`🔴 User ${userId} disconnected - Tabs:${userSocketCountMap.get(userId) || 0} | Active users: ${activeUserIds.size}`);

      if (remaining === 0) {
        try {
          await prisma.teleCMIUserStatus?.updateMany({
            where: { activeUserId: userId },
            data: { status: false, updatedAt: new Date() }
          });
          await fetchAndBroadcast();
        } catch (err) {
          logger.error("Socket disconnect update error:", err);
        }
      }
    });
  });

  logger.info("🚀 Socket server is ready");
  return io;
};

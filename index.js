import "express-async-errors";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { createServer } from "http";
import { env } from "./src/config/env.config.js";
import logger from "./src/config/logger.config.js";
import prisma from "./src/config/prisma.config.js";
import apiRoutes from "./src/routes/index.js";
import { setupTeleCMISocket } from "./src/config/webSocket.js";
import pinoHttp from "pino-http";

const app = express();
const httpServer = createServer(app);

// --- SECURITY & MIDDLEWARE ---
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use("/uploads", express.static("uploads"));

// --- REQUEST LOGGING ---
app.use(pinoHttp({ 
  logger,
  autoLogging: false,
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
    }),
  }
}));

// --- API ROUTES ---
app.use("/api", apiRoutes);

// --- HEALTH CHECK ---
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "UP",
      timestamp: new Date().toISOString(),
      database: "CONNECTED",
      node: process.version
    });
  } catch (error) {
    logger.error("Health check failed", error);
    res.status(503).json({ status: "DOWN", database: "DISCONNECTED" });
  }
});

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || "Internal Server Error",
      code: err.code || "INTERNAL_ERROR"
    }
  });
});

// --- SOCKET INITIALIZATION ---
setupTeleCMISocket(httpServer);

// --- STARTUP ---
const start = async () => {
  try {
    httpServer.listen(env.PORT, () => {
      logger.info(`🚀 Autoinn Modern Backend running on port ${env.PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
};

start();

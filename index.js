import "express-async-errors";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { env } from "./src/config/env.config.js";
import logger from "./src/config/logger.config.js";
import prisma from "./src/config/prisma.config.js";

const app = express();

// --- SECURITY & MIDDLEWARE ---
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- HEALTH CHECK ---
app.get("/health", async (req, res) => {
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

// --- STARTUP ---
const start = async () => {
  try {
    // Port is defined in env.config.js (default 4004)
    app.listen(env.PORT, () => {
      logger.info(`🚀 AutoInn Modern Backend running on port ${env.PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
};

start();

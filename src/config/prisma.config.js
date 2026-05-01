import { PrismaClient } from "@prisma/client";
import { env } from "./env.config.js";
import logger from "./logger.config.js";

const prisma = new PrismaClient({
  log: env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

export default prisma;

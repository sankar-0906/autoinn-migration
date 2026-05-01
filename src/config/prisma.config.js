import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { env } from "./env.config.js";

// 1. Create a PostgreSQL Pool
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

// 2. Initialize the Adapter with the correct schema
const adapter = new PrismaPg(pool, { schema: "default$default" });

// 3. Initialize Prisma Client with the adapter
const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

export default prisma;

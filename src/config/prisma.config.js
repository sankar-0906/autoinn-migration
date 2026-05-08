import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { env } from "./env.config.js";

const SCHEMA = "default$default";

// 1. Create a PostgreSQL Pool with the correct search_path
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

// Set search_path on every new connection so raw SQL finds the right schema
pool.on("connect", (client) => {
  client.query(`SET search_path TO "${SCHEMA}"`);
});

// 2. Initialize the Adapter with the correct schema
const adapter = new PrismaPg(pool, { schema: SCHEMA });

// 3. Initialize Prisma Client with the adapter
const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

export default prisma;

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env.js";

const isTest = process.env.NODE_ENV === "test";

const connectionString = isTest ? env.DATABASE_URL_TEST : env.DATABASE_URL;

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

export { prisma };

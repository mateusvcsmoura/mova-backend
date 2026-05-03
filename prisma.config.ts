import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const isTest = process.env.NODE_ENV === "test";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: isTest ? env("DIRECT_URL_TEST") : env("DIRECT_URL"),
  },
});

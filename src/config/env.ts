import { config } from "dotenv";
config();
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  SERVER_PORT: z.string().min(1),
  JWT_SECRET: z.string().min(1),

  JWT_EXPIRES_IN: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    "Invalid environment variables: " + JSON.stringify(parsed.error.format()),
  );
}

export const env = parsed.data;

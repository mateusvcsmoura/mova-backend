import { config } from "dotenv";
config();
import { z } from "zod";

const envSchema = z.object({
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_PORT: z.string().min(1),
  POSTGRES_HOST: z.string().min(1),
  POSTGRES_DATABASE: z.string().min(1),
  DATABASE_URL: z.string().url(),
  SERVER_PORT: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    "Invalid environment variables: " + JSON.stringify(parsed.error.format()),
  );
}

export const env = parsed.data;

import { config } from "dotenv";
config();
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url(),
  DIRECT_URL_TEST: z.string().url(),
  SERVER_PORT: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]),
  JWT_SECRET: z.string().min(1),

  JWT_EXPIRES_IN: z.string().min(1),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  FRONTEND_URL: z.string().url().optional(),

  CORS_ORIGINS: z.string().optional(),
  // Tamanho máximo do corpo JSON aceito (protege contra payloads abusivos).
  BODY_LIMIT: z.string().min(1).default("100kb"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  // Máx. de tentativas de autenticação (login/register) por IP na janela.
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  // Máx. de requisições de escrita (POST/PUT/PATCH/DELETE) por IP na janela.
  RATE_LIMIT_WRITE_MAX: z.coerce.number().int().positive().default(100),

  TIMEZONE_EXIBICAO: z.string().min(1).default("America/Sao_Paulo"),

  DESBLOQUEIO_RAIO_METROS: z.coerce.number().positive().default(100),

  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_FROM: z.string().min(1).optional(),

  PAGAMENTO_SANDBOX_PROVIDER: z
    .enum(["mercadopago", "stripe", "asaas"])
    .default("mercadopago"),
  PAGAMENTO_SIMULADOR_DELAY_MS: z.coerce
    .number()
    .int()
    .min(0)
    .default(process.env.NODE_ENV === "test" ? 0 : 1500),

  MERCADOPAGO_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  ASAAS_WEBHOOK_SECRET: z.string().min(1).optional(),

  MEDIA_S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  MEDIA_S3_REGION: z.string().min(1).default("us-east-1"),
  MEDIA_S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  MEDIA_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  MEDIA_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  MEDIA_PRIVATE_BUCKET: z.string().min(1).default("mova-media-private"),
  MEDIA_PUBLIC_BUCKET: z.string().min(1).default("mova-media-public"),
  MEDIA_PUBLIC_BASE_URL: z.string().url().default("http://localhost:9000/mova-media-public"),
  MEDIA_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  MEDIA_MAX_WIDTH: z.coerce.number().int().positive().default(4096),
  MEDIA_MAX_HEIGHT: z.coerce.number().int().positive().default(4096),
  MEDIA_MAX_IMAGES_PER_VEHICLE: z.coerce.number().int().positive().default(12),
  MEDIA_CLEANUP_MIN_AGE_MINUTES: z.coerce.number().int().nonnegative().default(60),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    "Invalid environment variables: " + JSON.stringify(parsed.error.format()),
  );
}

export const env = parsed.data;

if (env.NODE_ENV === "production") {
  if (!env.CORS_ORIGINS || env.CORS_ORIGINS.split(",").some((origin) => origin.trim() === "*")) {
    throw new Error("CORS_ORIGINS must explicitly whitelist production origins.");
  }
  if (env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters in production.");
  }
}

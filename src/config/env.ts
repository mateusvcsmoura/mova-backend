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

  // Segurança HTTP (hardening RNF05).
  // Origens permitidas pelo CORS, separadas por vírgula (ex.:
  // "https://app.mova.com,https://admin.mova.com"). Quando ausente, cai no
  // whitelist de desenvolvimento definido em app.ts. NUNCA usar "*".
  CORS_ORIGINS: z.string().optional(),
  // Tamanho máximo do corpo JSON aceito (protege contra payloads abusivos).
  BODY_LIMIT: z.string().min(1).default("100kb"),
  // Janela e limites do rate limiting. Flexíveis por ambiente sem tocar no
  // código; o padrão é janela de 15 min.
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  // Máx. de tentativas de autenticação (login/register) por IP na janela.
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  // Máx. de requisições de escrita (POST/PUT/PATCH/DELETE) por IP na janela.
  RATE_LIMIT_WRITE_MAX: z.coerce.number().int().positive().default(100),

  // Configuração SMTP (Nodemailer). Opcional: quando ausente, o envio de
  // e-mails fica desabilitado (útil em testes/dev) sem quebrar o boot.
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_FROM: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    "Invalid environment variables: " + JSON.stringify(parsed.error.format()),
  );
}

export const env = parsed.data;

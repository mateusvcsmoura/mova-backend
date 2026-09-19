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

  // Fuso usado para RENDERIZAR data/hora para humanos (e-mails, relatórios).
  // NÃO afeta armazenamento nem comparação: instantes trafegam e são gravados
  // em UTC. Sem isto, a formatação usaria o fuso do servidor — no Render (UTC)
  // um horário de 10:00 em São Paulo sairia como 13:00 no e-mail.
  TIMEZONE_EXIBICAO: z.string().min(1).default("America/Sao_Paulo"),

  // RN03: raio (em metros) do geofence de desbloqueio. O desbloqueio precisa
  // ocorrer dentro desse raio da última localização conhecida do veículo.
  // Quando não há localização de referência, o geofence é ignorado (permite).
  DESBLOQUEIO_RAIO_METROS: z.coerce.number().positive().default(100),

  // Configuração SMTP (Nodemailer). Opcional: quando ausente, o envio de
  // e-mails fica desabilitado (útil em testes/dev) sem quebrar o boot.
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_FROM: z.string().min(1).optional(),

  // Sandbox de pagamento: qual gateway o simulador usa para assinar o webhook,
  // e quanto ele demora para entregá-lo (0 = síncrono, usado nos testes).
  PAGAMENTO_SANDBOX_PROVIDER: z
    .enum(["mercadopago", "stripe", "asaas"])
    .default("mercadopago"),
  // 0 = o webhook é entregue na mesma requisição (determinístico, usado nos
  // testes). Em execução normal há atraso, para o cliente observar PROCESSANDO.
  PAGAMENTO_SIMULADOR_DELAY_MS: z.coerce
    .number()
    .int()
    .min(0)
    .default(process.env.NODE_ENV === "test" ? 0 : 1500),

  // Segredos de assinatura dos webhooks de pagamento. Um por gateway. Quando
  // ausente, o gateway correspondente rejeita todo webhook (não há como validar
  // a assinatura). NUNCA versionar valores reais — só o .env.example documenta.
  MERCADOPAGO_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  ASAAS_WEBHOOK_SECRET: z.string().min(1).optional(),
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

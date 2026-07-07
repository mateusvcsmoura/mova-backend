import express from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { writeMethodsLimiter } from "./middlewares/rate-limit.js";
import { observability } from "./middlewares/observability.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { healthRouter } from "./routes/health/health.js";
import { basicRouter } from "./routes/basic/basic.js";
import { contaRouter } from "./routes/conta/conta.js";
import { locadorRouter } from "./routes/locador/locador.js";
import { locatarioRouter } from "./routes/locatario/locatario.js";
import { veiculoRouter } from "./routes/veiculo/veiculo.js";
import { apiMetadata } from "./middlewares/api-version.js";
import { adminRouter } from "./routes/admin/admin.js";
import { deficienciaRouter } from "./routes/deficiencia/deficiencia.js";
import { garagemRouter } from "./routes/garagem/garagem.js";
import { reservaRouter } from "./routes/reserva/reserva.js";
import { servicoOpcionalRouter } from "./routes/servico-opcional/servico-opcional.js";
import { localizacaoRouter } from "./routes/localizacao/localizacao.js";
import { avaliacaoRouter } from "./routes/avaliacao/avaliacao.js";
import { favoritoRouter } from "./routes/favorito/favorito.js";
import { interesseRouter } from "./routes/interesse/interesse.js";
import { dashboardRouter } from "./routes/dashboard/dashboard.js";
import { webhookRouter } from "./routes/webhook/webhook.js";
import { lgpdRouter } from "./routes/lgpd/lgpd.js";

const app = express();

// Origens permitidas: da env (CORS_ORIGINS, separadas por vírgula) ou, na
// ausência, um whitelist de desenvolvimento. NUNCA "*".
const DEV_ORIGINS = ["http://localhost:3000", "http://localhost:5173"];
const allowedOrigins = env.CORS_ORIGINS
  ? env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : DEV_ORIGINS;

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Sem header Origin (apps móveis, curl, server-to-server): permitido.
    if (!origin) return callback(null, true);
    // Origem na whitelist: libera; caso contrário, não envia os headers CORS
    // (o navegador bloqueia). Não lança erro para não virar 500.
    return callback(null, allowedOrigins.includes(origin));
  },
  credentials: true,
};

// Observabilidade primeiro: garante request id + timing para toda requisição,
// inclusive as bloqueadas por middlewares seguintes.
app.use(observability);

// Helmet: headers de segurança. crossOriginResourcePolicy relaxado para
// "cross-origin" — a API é consumida por clientes de outra origem (mobile/web).
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(cors(corsOptions));

// Webhooks de pagamento ANTES do express.json: precisam do corpo cru (bytes
// exatos) para validar a assinatura HMAC. O próprio router aplica express.raw.
app.use("/api/webhooks", webhookRouter);

app.use(express.json({ limit: env.BODY_LIMIT }));

// Health/readiness antes do apiMetadata: respostas enxutas (status/uptime/...)
// sem o envelope de metadados, no formato esperado por orquestradores.
app.use(healthRouter);

app.use(apiMetadata("v1.0.0"));

// Rate limiting das rotas de escrita (POST/PUT/PATCH/DELETE). Autenticação tem
// limitador próprio, mais estrito, aplicado na rota de conta.
app.use(writeMethodsLimiter);

app.use("/api/basic", basicRouter);
app.use("/api/admin", adminRouter);
app.use("/api/deficiencia", deficienciaRouter);
app.use("/api/conta", contaRouter);
app.use("/api/locador", locadorRouter);
app.use("/api/locatario", locatarioRouter);
app.use("/api/veiculo", veiculoRouter);
app.use("/api/garagem", garagemRouter);
app.use("/api/reserva", reservaRouter);
app.use("/api/servico", servicoOpcionalRouter);
app.use("/api/localizacao", localizacaoRouter);
app.use("/api/avaliacao", avaliacaoRouter);
app.use("/api/favorito", favoritoRouter);
app.use("/api/interesse", interesseRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/lgpd", lgpdRouter);

app.use(errorHandler);

export { app };

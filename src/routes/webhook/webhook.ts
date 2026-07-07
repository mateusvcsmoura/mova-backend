import { Router } from "express";
import express from "express";

import { env } from "../../config/env.js";
import { pagamentoWebhookController } from "../container.js";

const webhookRouter = Router();

// Webhook de gateway de pagamento. SEM autenticação por JWT — a confiança vem
// da assinatura validada no service. express.raw preserva o corpo cru (bytes
// exatos) necessário para conferir o HMAC; por isso este router é montado ANTES
// do express.json global (ver app.ts).
webhookRouter.post(
  "/pagamento/:provider",
  express.raw({ type: "*/*", limit: env.BODY_LIMIT }),
  pagamentoWebhookController.handle,
);

export { webhookRouter };

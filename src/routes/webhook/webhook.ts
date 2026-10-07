import { Router } from "express";
import express from "express";

import { env } from "../../config/env.js";
import { pagamentoWebhookController } from "../container.js";

const webhookRouter = Router();

webhookRouter.post(
  "/pagamento/:provider",
  express.raw({ type: "*/*", limit: env.BODY_LIMIT }),
  pagamentoWebhookController.handle,
);

export { webhookRouter };

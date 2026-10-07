import { Handler } from "express";

import { PagamentoWebhookService } from "../services/pagamento-webhook.js";

export class PagamentoWebhookController {
  constructor(private webhookService: PagamentoWebhookService) {}

  handle: Handler = async (req, res, next) => {
    try {
      const provider = String(req.params.provider);
      const rawBody: Buffer = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from("");

      await this.webhookService.processar(provider, rawBody, req.headers);

      return res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  };
}

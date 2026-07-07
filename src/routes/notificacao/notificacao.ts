import { Router } from "express";

import { preferenciaNotificacaoController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";

const notificacaoRouter = Router();

// Preferências de notificação do próprio usuário (opt-in/opt-out).
notificacaoRouter.get(
  "/preferencias",
  authMiddleware,
  preferenciaNotificacaoController.listar,
);
notificacaoRouter.put(
  "/preferencias",
  authMiddleware,
  preferenciaNotificacaoController.definir,
);

export { notificacaoRouter };

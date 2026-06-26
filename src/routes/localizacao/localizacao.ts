import { Router } from "express";
import { Cargo } from "@prisma/client";
import { localizacaoController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";
import { authorize } from "../../middlewares/authorization-middleware.js";

const localizacaoRouter = Router();

// Última localização: rota mais específica vem antes do histórico.
localizacaoRouter.get(
  "/veiculo/:id_veiculo/ultima",
  authMiddleware,
  localizacaoController.ultima,
);
localizacaoRouter.get(
  "/veiculo/:id_veiculo",
  authMiddleware,
  localizacaoController.historico,
);

// Registro de novo ponto: fonte confiável (locador/telemetria/admin).
localizacaoRouter.post(
  "/",
  authMiddleware,
  authorize(Cargo.LOCADOR, Cargo.ADMIN),
  localizacaoController.registrar,
);

export { localizacaoRouter };

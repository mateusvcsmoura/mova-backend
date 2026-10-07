import express, { Handler, Router } from "express";
import { Cargo } from "@prisma/client";
import { env } from "../../config/env.js";
import { veiculoController, veiculoImagemController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";
import { authorize } from "../../middlewares/authorization-middleware.js";

const veiculoRouter = Router();

const gerencia = [authMiddleware, authorize(Cargo.LOCADOR, Cargo.ADMIN)];
const autenticacaoOpcional: Handler = (req, res, next) => {
  if (!req.headers.authorization) return next();
  return authMiddleware(req, res, next);
};

veiculoRouter.get("/locador/:id_locador", veiculoController.findByLocadorId);
veiculoRouter.get("/meus", ...gerencia, veiculoController.frota);
veiculoRouter.get("/:id/imagens", autenticacaoOpcional, veiculoImagemController.listar);
veiculoRouter.get("/:id", autenticacaoOpcional, veiculoController.findById);

// ── Escrita (protegida) ──────────────────────────────────────────────────
veiculoRouter.post("/lote", ...gerencia, veiculoController.createLote);
veiculoRouter.patch("/modelos/:id_modelo", ...gerencia, veiculoController.updateModelo);
veiculoRouter.patch("/:id_veiculo/modelo", ...gerencia, veiculoController.updateModeloDoVeiculo);

// ── Listagem autenticada (escopada por cargo no service) ───────────────────
veiculoRouter.get("/", autenticacaoOpcional, veiculoController.index);

veiculoRouter.post("/", ...gerencia, veiculoController.create);
veiculoRouter.post(
  "/:id/imagens",
  ...gerencia,
  express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: env.MEDIA_MAX_BYTES }),
  veiculoImagemController.criar,
);
veiculoRouter.put("/:id/imagens/ordem", ...gerencia, veiculoImagemController.reordenar);
veiculoRouter.post("/:id/imagens/:imagemId/capa", ...gerencia, veiculoImagemController.definirCapa);
veiculoRouter.delete("/:id/imagens/:imagemId", ...gerencia, veiculoImagemController.excluir);
veiculoRouter.put("/:id", ...gerencia, veiculoController.update);
veiculoRouter.delete("/:id", ...gerencia, veiculoController.delete);

export { veiculoRouter };

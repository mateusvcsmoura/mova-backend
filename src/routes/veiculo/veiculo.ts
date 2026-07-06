import { Router } from "express";
import { Cargo } from "@prisma/client";
import { veiculoController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";
import { authorize } from "../../middlewares/authorization-middleware.js";

const veiculoRouter = Router();

// Escrita: exige autenticação e cargo LOCADOR/ADMIN. A posse do recurso
// (locador só mexe nos próprios veículos/modelos) é validada no service.
const gerencia = [authMiddleware, authorize(Cargo.LOCADOR, Cargo.ADMIN)];

// ── Consulta pública (catálogo) ────────────────────────────────────────────
// Não expõem veículos INATIVO; listagem por locador retorna só DISPONIVEL
// (regra aplicada no VeiculoService).
veiculoRouter.get("/locador/:id_locador", veiculoController.findByLocadorId);
veiculoRouter.get("/:id", veiculoController.findById);

// ── Escrita (protegida) ──────────────────────────────────────────────────
veiculoRouter.post("/lote", ...gerencia, veiculoController.createLote);
veiculoRouter.patch("/modelos/:id_modelo", ...gerencia, veiculoController.updateModelo);
veiculoRouter.patch("/:id_veiculo/modelo", ...gerencia, veiculoController.updateModeloDoVeiculo);

// ── Listagem autenticada (escopada por cargo no service) ───────────────────
veiculoRouter.get("/", authMiddleware, veiculoController.index);

veiculoRouter.post("/", ...gerencia, veiculoController.create);
veiculoRouter.put("/:id", ...gerencia, veiculoController.update);
veiculoRouter.delete("/:id", ...gerencia, veiculoController.delete);

export { veiculoRouter };

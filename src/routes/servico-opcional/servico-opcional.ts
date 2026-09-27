import { Router } from "express";
import { servicoOpcionalController } from "../container.js";

const servicoOpcionalRouter = Router();

// Catálogo público de serviços opcionais ativos; não há rotas de escrita aqui.
servicoOpcionalRouter.get("/", servicoOpcionalController.index);
servicoOpcionalRouter.get(
  "/:id",
  servicoOpcionalController.findById,
);

export { servicoOpcionalRouter };

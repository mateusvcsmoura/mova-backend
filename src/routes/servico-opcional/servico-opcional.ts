import { Router } from "express";
import { servicoOpcionalController } from "../container.js";

const servicoOpcionalRouter = Router();

// Listagem dos serviços opcionais disponíveis (qualquer usuário autenticado).
servicoOpcionalRouter.get("/", servicoOpcionalController.index);
servicoOpcionalRouter.get(
  "/:id",
  servicoOpcionalController.findById,
);

export { servicoOpcionalRouter };

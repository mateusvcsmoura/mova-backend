import { Router } from "express";
import { servicoOpcionalController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";

const servicoOpcionalRouter = Router();

// Listagem dos serviços opcionais disponíveis (qualquer usuário autenticado).
servicoOpcionalRouter.get("/", authMiddleware, servicoOpcionalController.index);
servicoOpcionalRouter.get(
  "/:id",
  authMiddleware,
  servicoOpcionalController.findById,
);

export { servicoOpcionalRouter };

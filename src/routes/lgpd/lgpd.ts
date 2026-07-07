import { Router } from "express";

import { lgpdController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";

const lgpdRouter = Router();

// Autoatendimento do titular (usa a conta autenticada).
lgpdRouter.get("/meus-dados", authMiddleware, lgpdController.exportar);
lgpdRouter.get("/acessos", authMiddleware, lgpdController.acessos);
lgpdRouter.post("/anonimizar", authMiddleware, lgpdController.anonimizar);

// Por titular específico. O service autoriza: só ADMIN (ou o próprio) passa.
lgpdRouter.get("/:id/dados", authMiddleware, lgpdController.exportar);
lgpdRouter.get("/:id/acessos", authMiddleware, lgpdController.acessos);
lgpdRouter.post("/:id/anonimizar", authMiddleware, lgpdController.anonimizar);

export { lgpdRouter };

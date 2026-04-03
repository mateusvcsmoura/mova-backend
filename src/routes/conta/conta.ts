import { Router } from "express";
import { contaController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";

const contaRouter = Router();

contaRouter.post("/auth/register", contaController.register);
contaRouter.post("/auth/login", contaController.login);
contaRouter.patch("/auth/change-password", authMiddleware,contaController.changePassword);
contaRouter.delete("/auth/delete-account", authMiddleware, contaController.deleteAccount);

export { contaRouter };

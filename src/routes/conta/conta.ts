import { Router } from "express";
import { contaController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";
import { authLimiter } from "../../middlewares/rate-limit.js";

const contaRouter = Router();

// Rate limit estrito na autenticação (brute-force / credential stuffing).
contaRouter.post("/auth/register", authLimiter, contaController.register);
contaRouter.post("/auth/login", authLimiter, contaController.login);
contaRouter.get("/auth/me", authMiddleware, contaController.getCurrentAccount);
contaRouter.put("/auth/update-profile", authMiddleware, contaController.updateProfile);
contaRouter.patch("/auth/change-password", authMiddleware, contaController.changePassword);
contaRouter.delete("/auth/delete-account", authMiddleware, contaController.deleteAccount);

export { contaRouter };

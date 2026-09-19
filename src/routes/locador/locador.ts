import { Router } from "express";
import { Cargo } from "@prisma/client";
import { locadorController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";
import { authorize } from "../../middlewares/authorization-middleware.js";

const locadorRouter = Router();
const gerenciaPerfil = [authMiddleware, authorize(Cargo.LOCADOR, Cargo.ADMIN)];

locadorRouter.get("/all", ...gerenciaPerfil, locadorController.index);
locadorRouter.get("/search", ...gerenciaPerfil, locadorController.findByCnpjOrEmpresa);
locadorRouter.post("/", ...gerenciaPerfil, locadorController.create);
locadorRouter.get("/:id", ...gerenciaPerfil, locadorController.findById);
locadorRouter.put("/:id", ...gerenciaPerfil, locadorController.update);
locadorRouter.delete("/:id", ...gerenciaPerfil, locadorController.delete);

export { locadorRouter };

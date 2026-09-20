import { Router } from "express";
import { Cargo } from "@prisma/client";
import { locatarioController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";
import { authorize } from "../../middlewares/authorization-middleware.js";

const locatarioRouter = Router();
const gerenciaPerfil = [authMiddleware, authorize(Cargo.LOCATARIO, Cargo.ADMIN)];

locatarioRouter.get("/all", ...gerenciaPerfil, locatarioController.index);
locatarioRouter.get("/search", ...gerenciaPerfil, locatarioController.findByCpfOrCnh);
locatarioRouter.post("/", ...gerenciaPerfil, locatarioController.create);
locatarioRouter.get("/:id", ...gerenciaPerfil, locatarioController.findById);
locatarioRouter.put("/:id", ...gerenciaPerfil, locatarioController.update);
locatarioRouter.delete("/:id", ...gerenciaPerfil, locatarioController.delete);

export { locatarioRouter };

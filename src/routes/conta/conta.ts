import { Router } from "express";
import { contaController } from "../container.js";

const contaRouter = Router();

contaRouter.get("/all", contaController.index);
contaRouter.get("/", contaController.findByEmail);
contaRouter.get("/:id", contaController.findById);

export { contaRouter };

import { Router } from "express";
import { contaController } from "../container.js";

const contaRouter = Router();

contaRouter.get("/all", contaController.index);
contaRouter.get("/", contaController.findByEmail);
contaRouter.get("/:id", contaController.findById);
contaRouter.post("/create", contaController.create);
contaRouter.put("/update/:id", contaController.update);

export { contaRouter };

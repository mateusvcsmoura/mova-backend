import { Router } from "express";
import { locadorController } from "../container.js";

const locadorRouter = Router();

locadorRouter.get("/all", locadorController.index);
locadorRouter.get("/search", locadorController.findByCnpjOrEmpresa);
locadorRouter.post("/", locadorController.create);
locadorRouter.get("/:id", locadorController.findById);
locadorRouter.put("/:id", locadorController.update);
locadorRouter.delete("/:id", locadorController.delete);

export { locadorRouter };

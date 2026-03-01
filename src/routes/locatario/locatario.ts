import { Router } from "express";
import { locatarioController } from "../container.js";

const locatarioRouter = Router();

locatarioRouter.get("/all", locatarioController.index);
locatarioRouter.get("/search", locatarioController.findByCpfOrCnh);
locatarioRouter.post("/", locatarioController.create);
locatarioRouter.get("/:id", locatarioController.findById);
locatarioRouter.put("/:id", locatarioController.update);
locatarioRouter.delete("/:id", locatarioController.delete);

export { locatarioRouter };

import { Router } from "express";
import { veiculoController } from "../container.js";

const veiculoRouter = Router();

veiculoRouter.get("/all", veiculoController.index);
veiculoRouter.get("/search", veiculoController.search);
veiculoRouter.get("/locador/:id", veiculoController.findByLocadorId);
veiculoRouter.get("/:id", veiculoController.findById);
veiculoRouter.post("/", veiculoController.create);
veiculoRouter.put("/:id", veiculoController.update);
veiculoRouter.delete("/:id", veiculoController.delete);

export { veiculoRouter };

import { Router } from "express";
import { veiculoController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";

const veiculoRouter = Router();

veiculoRouter.get("/search", veiculoController.search);
veiculoRouter.get("/locador/:id_locador", veiculoController.findByLocadorId);
veiculoRouter.get("/:id", veiculoController.findById);
veiculoRouter.get("/", authMiddleware, veiculoController.index);
veiculoRouter.post("/", veiculoController.create);
veiculoRouter.put("/:id", veiculoController.update);
veiculoRouter.delete("/:id", veiculoController.delete);

export { veiculoRouter };

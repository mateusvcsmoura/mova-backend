import { Router } from "express";
import { deficienciaController } from "../container.js";

const deficienciaRouter = Router();

deficienciaRouter.get("/all", deficienciaController.index);
deficienciaRouter.get("/search", deficienciaController.findByDescription);
deficienciaRouter.post("/", deficienciaController.create);
deficienciaRouter.get("/:id", deficienciaController.findById);
deficienciaRouter.put("/:id", deficienciaController.update);
deficienciaRouter.delete("/:id", deficienciaController.delete);

export { deficienciaRouter };

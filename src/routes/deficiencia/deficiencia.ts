import { Router } from "express";
import { deficienciaController } from "../container.js";
import { authorize } from "../../middlewares/authorization-middleware.js";
import { Cargo } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth-middleware.js";

const deficienciaRouter = Router();

deficienciaRouter.get("/all", deficienciaController.index);
deficienciaRouter.get("/search", deficienciaController.findByDescription);
deficienciaRouter.post("/",  authMiddleware, authorize(Cargo.ADMIN), deficienciaController.create);
deficienciaRouter.get("/:id", deficienciaController.findById);
deficienciaRouter.put("/:id", authMiddleware, authorize(Cargo.ADMIN),deficienciaController.update);
deficienciaRouter.delete("/:id", authMiddleware, authorize(Cargo.ADMIN), deficienciaController.delete);

export { deficienciaRouter };


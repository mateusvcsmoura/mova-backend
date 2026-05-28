import { Router } from "express";
import { deficienciaController } from "../container.js";
import { authorize } from "../../middlewares/authorization-middleware.js";
import { Cargo } from "@prisma/client";
import { authMiddleware } from "../../middlewares/auth-middleware.js";

const deficienciaRouter = Router();

deficienciaRouter.get("/deficiencia/all", deficienciaController.index);
deficienciaRouter.get("/deficiencia/search", deficienciaController.findByDescription);
deficienciaRouter.post("/deficiencia",  authMiddleware, authorize(Cargo.ADMIN), deficienciaController.create);
deficienciaRouter.get("/deficiencia/:id", deficienciaController.findById);
deficienciaRouter.put("/deficiencia/:id", authMiddleware, authorize(Cargo.ADMIN),deficienciaController.update);
deficienciaRouter.delete("/deficiencia/:id", authMiddleware, authorize(Cargo.ADMIN), deficienciaController.delete);

export { deficienciaRouter };


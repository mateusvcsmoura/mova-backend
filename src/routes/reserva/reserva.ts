import { Router } from "express";
import { Cargo } from "@prisma/client";
import { reservaController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";
import { authorize } from "../../middlewares/authorization-middleware.js";

const reservaRouter = Router();

reservaRouter.get(
  "/locatario/:id_locatario",
  authMiddleware,
  authorize(Cargo.LOCATARIO, Cargo.ADMIN),
  reservaController.findByLocatarioId,
);
reservaRouter.get(
  "/veiculo/:id_veiculo",
  authMiddleware,
  authorize(Cargo.LOCADOR, Cargo.ADMIN),
  reservaController.findByVeiculoId,
);
reservaRouter.get("/", authMiddleware, reservaController.index);
reservaRouter.get("/:id", authMiddleware, reservaController.findById);
reservaRouter.post(
  "/",
  authMiddleware,
  authorize(Cargo.LOCATARIO, Cargo.ADMIN),
  reservaController.create,
);
reservaRouter.post(
  "/:id/desbloqueio",
  authMiddleware,
  authorize(Cargo.LOCATARIO, Cargo.ADMIN),
  reservaController.desbloquear,
);
reservaRouter.put("/:id", authMiddleware, reservaController.update);
reservaRouter.delete("/:id", authMiddleware, reservaController.delete);

export { reservaRouter };

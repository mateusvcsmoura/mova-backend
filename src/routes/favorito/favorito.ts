import { Router } from "express";
import { Cargo } from "@prisma/client";
import { favoritoController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";
import { authorize } from "../../middlewares/authorization-middleware.js";

const favoritoRouter = Router();

favoritoRouter.get(
  "/",
  authMiddleware,
  authorize(Cargo.LOCATARIO),
  favoritoController.index,
);
favoritoRouter.get(
  "/veiculo/:id_veiculo",
  authMiddleware,
  authorize(Cargo.LOCATARIO),
  favoritoController.verificar,
);
favoritoRouter.post(
  "/",
  authMiddleware,
  authorize(Cargo.LOCATARIO),
  favoritoController.create,
);
favoritoRouter.delete(
  "/veiculo/:id_veiculo",
  authMiddleware,
  authorize(Cargo.LOCATARIO),
  favoritoController.delete,
);

export { favoritoRouter };

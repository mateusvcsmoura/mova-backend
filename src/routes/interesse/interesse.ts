import { Router } from "express";
import { Cargo } from "@prisma/client";
import { interesseController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";
import { authorize } from "../../middlewares/authorization-middleware.js";

const interesseRouter = Router();

// Inscrições de interesse pertencem exclusivamente ao locatário autenticado
// (req.user.id) — nenhuma rota aceita id de locatário como parâmetro.
interesseRouter.get(
  "/",
  authMiddleware,
  authorize(Cargo.LOCATARIO),
  interesseController.index,
);
interesseRouter.post(
  "/",
  authMiddleware,
  authorize(Cargo.LOCATARIO),
  interesseController.create,
);
interesseRouter.delete(
  "/veiculo/:id_veiculo",
  authMiddleware,
  authorize(Cargo.LOCATARIO),
  interesseController.delete,
);

export { interesseRouter };

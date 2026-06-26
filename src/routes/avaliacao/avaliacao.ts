import { Router } from "express";
import { Cargo } from "@prisma/client";
import { avaliacaoController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";
import { authorize } from "../../middlewares/authorization-middleware.js";

const avaliacaoRouter = Router();

avaliacaoRouter.get(
  "/reserva/:id_reserva",
  authMiddleware,
  avaliacaoController.findByReserva,
);
avaliacaoRouter.post(
  "/",
  authMiddleware,
  authorize(Cargo.LOCATARIO, Cargo.ADMIN),
  avaliacaoController.create,
);

export { avaliacaoRouter };

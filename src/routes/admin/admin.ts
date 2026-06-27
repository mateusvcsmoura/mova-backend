import { Router } from "express";
import { Cargo } from "@prisma/client";
import { bloqueioController, contaController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";
import { authorize } from "../../middlewares/authorization-middleware.js";

const adminRouter = Router();

// CONTA
adminRouter.get("/conta/all", contaController.index);
adminRouter.get("/conta/", contaController.findByEmail);
adminRouter.get("/conta/:id", contaController.findById);
adminRouter.post("/conta/create", contaController.create);
adminRouter.put("/conta/update/:id", contaController.update);
adminRouter.delete("/conta/delete/:id", contaController.delete);

// BLOQUEIO DE LOCATÁRIO (somente ADMIN)
adminRouter.post(
  "/bloqueio",
  authMiddleware,
  authorize(Cargo.ADMIN),
  bloqueioController.create,
);
adminRouter.get(
  "/bloqueio/locatario/:idLocatario",
  authMiddleware,
  authorize(Cargo.ADMIN),
  bloqueioController.listByLocatario,
);
adminRouter.get(
  "/bloqueio/:id",
  authMiddleware,
  authorize(Cargo.ADMIN),
  bloqueioController.findById,
);
// Revogação preserva o histórico (não deleta o registro).
adminRouter.post(
  "/bloqueio/:id/revogar",
  authMiddleware,
  authorize(Cargo.ADMIN),
  bloqueioController.revogar,
);

export { adminRouter };

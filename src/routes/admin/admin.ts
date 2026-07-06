import { Router } from "express";
import { Cargo } from "@prisma/client";
import {
  bloqueioController,
  contaController,
  monitoramentoController,
} from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";
import { authorize } from "../../middlewares/authorization-middleware.js";

const adminRouter = Router();

// CONTA (somente ADMIN) — gerenciamento administrativo global de contas.
adminRouter.get("/conta/all", authMiddleware, authorize(Cargo.ADMIN), contaController.index);
adminRouter.get("/conta/", authMiddleware, authorize(Cargo.ADMIN), contaController.findByEmail);
adminRouter.get("/conta/:id", authMiddleware, authorize(Cargo.ADMIN), contaController.findById);
adminRouter.post("/conta/create", authMiddleware, authorize(Cargo.ADMIN), contaController.create);
adminRouter.put("/conta/update/:id", authMiddleware, authorize(Cargo.ADMIN), contaController.update);
adminRouter.delete("/conta/delete/:id", authMiddleware, authorize(Cargo.ADMIN), contaController.delete);

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

// MONITORAMENTO DA FROTA (somente ADMIN) — acionamento manual da rotina que
// normalmente roda via scheduler no boot.
adminRouter.post(
  "/monitoramento/executar",
  authMiddleware,
  authorize(Cargo.ADMIN),
  monitoramentoController.executar,
);

export { adminRouter };

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
// QR Code de desbloqueio (RN03): GET obtém o token assinado; POST desbloqueia
// resolvendo o QR para o mesmo código textual.
reservaRouter.get(
  "/:id/desbloqueio/qr",
  authMiddleware,
  authorize(Cargo.LOCATARIO, Cargo.ADMIN),
  reservaController.gerarQrDesbloqueio,
);
reservaRouter.post(
  "/:id/desbloqueio/qr",
  authMiddleware,
  authorize(Cargo.LOCATARIO, Cargo.ADMIN),
  reservaController.desbloquearQr,
);
// Cancelamento (RN04). Acesso (dono/admin/locador) validado no service.
reservaRouter.post("/:id/cancelar", authMiddleware, reservaController.cancelar);
// Devolução (RN06). Acesso validado no service.
reservaRouter.post("/:id/devolucao", authMiddleware, reservaController.devolver);
reservaRouter.put("/:id", authMiddleware, reservaController.update);
reservaRouter.delete("/:id", authMiddleware, reservaController.delete);

// Condutores adicionais (RF12). Acesso (dono/admin/locador) validado no service.
reservaRouter.get(
  "/:id/condutores",
  authMiddleware,
  reservaController.listarCondutores,
);
reservaRouter.post(
  "/:id/condutores",
  authMiddleware,
  authorize(Cargo.LOCATARIO, Cargo.ADMIN),
  reservaController.adicionarCondutor,
);
reservaRouter.delete(
  "/:id/condutores/:id_condutor",
  authMiddleware,
  authorize(Cargo.LOCATARIO, Cargo.ADMIN),
  reservaController.removerCondutor,
);

export { reservaRouter };

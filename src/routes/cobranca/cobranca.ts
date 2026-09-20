import { Cargo } from "@prisma/client";
import { Router } from "express";
import { cobrancaController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";
import { authorize } from "../../middlewares/authorization-middleware.js";
const cobrancaRouter = Router();
cobrancaRouter.get("/pendentes", authMiddleware, authorize(Cargo.LOCATARIO), cobrancaController.listarPendentes);
cobrancaRouter.post("/:id/pagamento", authMiddleware, authorize(Cargo.LOCATARIO), cobrancaController.pagar);
export { cobrancaRouter };

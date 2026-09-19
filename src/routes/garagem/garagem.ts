import { Router } from "express";
import { Cargo } from "@prisma/client";
import { garagemController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";
import { authorize } from "../../middlewares/authorization-middleware.js";

const garagemRouter = Router();

garagemRouter.get("/:id/veiculos", authMiddleware, authorize(Cargo.LOCADOR, Cargo.ADMIN), garagemController.findVeiculos);
garagemRouter.post("/:garagemId/veiculos/:veiculoId", authMiddleware, authorize(Cargo.LOCADOR), garagemController.alocarVeiculo);
garagemRouter.delete("/:garagemId/veiculos/:veiculoId", authMiddleware, authorize(Cargo.LOCADOR), garagemController.desalocarVeiculo);
// Leitura aberta ao LOCATARIO (escopo aplicado no GaragemService: só ATIVAS).
garagemRouter.get("/", authMiddleware, authorize(Cargo.LOCADOR, Cargo.ADMIN, Cargo.LOCATARIO), garagemController.index);
garagemRouter.get("/:id", authMiddleware, authorize(Cargo.LOCADOR, Cargo.ADMIN, Cargo.LOCATARIO), garagemController.findById);
garagemRouter.post("/", authMiddleware, authorize(Cargo.LOCADOR, Cargo.ADMIN), garagemController.create);
garagemRouter.put("/:id", authMiddleware, authorize(Cargo.LOCADOR, Cargo.ADMIN), garagemController.update);
garagemRouter.delete("/:id", authMiddleware, authorize(Cargo.LOCADOR, Cargo.ADMIN), garagemController.delete);

export { garagemRouter };

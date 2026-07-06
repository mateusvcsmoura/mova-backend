import { Router } from "express";
import { Cargo } from "@prisma/client";
import { locadorDashboardController } from "../container.js";
import { authMiddleware } from "../../middlewares/auth-middleware.js";
import { authorize } from "../../middlewares/authorization-middleware.js";

// Dashboard do locador (RF17/RF18). Exclusivo do LOCADOR; todos os dados são
// dos próprios veículos (idLocador do token).
const dashboardRouter = Router();

const soLocador = [authMiddleware, authorize(Cargo.LOCADOR)];

dashboardRouter.get("/reservas", ...soLocador, locadorDashboardController.reservas);
dashboardRouter.get("/financeiro", ...soLocador, locadorDashboardController.financeiro);
dashboardRouter.get("/utilizacao", ...soLocador, locadorDashboardController.utilizacao);
dashboardRouter.get("/frota", ...soLocador, locadorDashboardController.frota);

export { dashboardRouter };

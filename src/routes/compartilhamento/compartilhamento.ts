import { Router } from "express";
import { compartilhamentoReservaController } from "../container.js";

const compartilhamentoRouter = Router();

compartilhamentoRouter.get("/:token", compartilhamentoReservaController.publico);

export { compartilhamentoRouter };

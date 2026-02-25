import { Router } from "express";
import { locadorController } from "../container.js";

const locadorRouter = Router();

locadorRouter.get("/all", locadorController.index);

export { locadorRouter };

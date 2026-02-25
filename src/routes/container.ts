import { ContaController } from "../controllers/conta.js";
import { LocadorController } from "../controllers/locador.js";
import { ContaRepository } from "../repositories/conta.repository.js";
import { LocadorRepository } from "../repositories/locador.repository.js";
import { ContaService } from "../services/conta.js";
import { LocadorService } from "../services/locador.js";

export const contaRepository = new ContaRepository();
export const contaService = new ContaService(contaRepository);
export const contaController = new ContaController(contaService);

export const locadorRepository = new LocadorRepository();
export const locadorService = new LocadorService(locadorRepository);
export const locadorController = new LocadorController(locadorService);

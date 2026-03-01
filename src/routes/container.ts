import { ContaController } from "../controllers/conta.js";
import { LocadorController } from "../controllers/locador.js";
import { LocatarioController } from "../controllers/locatario.js";
import { ContaRepository } from "../repositories/conta.repository.js";
import { LocadorRepository } from "../repositories/locador.repository.js";
import { LocatarioRepository } from "../repositories/locatario.repository.js";
import { ContaService } from "../services/conta.js";
import { LocadorService } from "../services/locador.js";
import { LocatarioService } from "../services/locatario.js";

export const contaRepository = new ContaRepository();
export const contaService = new ContaService(contaRepository);
export const contaController = new ContaController(contaService);

export const locadorRepository = new LocadorRepository();
export const locadorService = new LocadorService(locadorRepository);
export const locadorController = new LocadorController(locadorService);

export const locatarioRepository = new LocatarioRepository();
export const locatarioService = new LocatarioService(locatarioRepository);
export const locatarioController = new LocatarioController(locatarioService);

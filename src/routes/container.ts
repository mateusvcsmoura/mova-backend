import { ContaController } from "../controllers/conta.js";
import { ContaRepository } from "../repositories/conta.repository.js";
import { ContaService } from "../services/conta.js";

export const contaRepository = new ContaRepository();
export const contaService = new ContaService(contaRepository);
export const contaController = new ContaController(contaService);



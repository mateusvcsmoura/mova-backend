import { Handler } from "express";

import { MonitoramentoVeiculoService } from "../services/monitoramento-veiculo.js";
import { HttpError } from "../errors/HttpError.js";

// Acionamento manual da rotina de monitoramento (uso administrativo/dev). A
// execução periódica em si acontece via MonitoramentoScheduler no boot — este
// endpoint apenas reaproveita o mesmo service.
export class MonitoramentoController {
  constructor(
    private readonly monitoramentoService: MonitoramentoVeiculoService,
  ) {}

  executar: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const resultado = await this.monitoramentoService.executar();
      return res.status(200).json({ result: resultado });
    } catch (error) {
      next(error);
    }
  };
}

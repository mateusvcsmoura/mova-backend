import { Handler } from "express";
import { z } from "zod";
import { HttpError } from "../errors/HttpError.js";
import { iniciarPagamentoSchema } from "../schemas/pagamento.schema.js";
import { CobrancaService } from "../services/cobranca.js";

export class CobrancaController {
  constructor(private readonly service: CobrancaService) {}
  listarPendentes: Handler = async (req, res, next) => { try { if (!req.user) throw new HttpError(401, "Não autenticado"); return res.json({ result: await this.service.listarPendentes(req.user) }); } catch (e) { next(e); } };
  pagar: Handler = async (req, res, next) => { try { if (!req.user) throw new HttpError(401, "Não autenticado"); const id = z.string().uuid().parse(req.params.id); const dados = iniciarPagamentoSchema.parse(req.body); return res.status(202).json({ result: await this.service.pagar(id, dados, req.user) }); } catch (e) { next(e); } };
}

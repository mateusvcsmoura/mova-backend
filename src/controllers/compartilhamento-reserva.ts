import { Handler } from "express";
import { z } from "zod";

import { HttpError } from "../errors/HttpError.js";
import { CompartilhamentoReservaService } from "../services/compartilhamento-reserva.js";

const tokenSchema = z.string().min(40).max(200);

export class CompartilhamentoReservaController {
  constructor(private readonly service: CompartilhamentoReservaService) {}

  criar: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const id = z.string().uuid().safeParse(req.params.id);
      if (!id.success) throw new HttpError(400, "ID inválido");
      const resultado = await this.service.criar(id.data, req.user);
      return res.status(resultado.criado ? 201 : 200).json({ result: resultado.response });
    } catch (error) {
      next(error);
    }
  };

  revogar: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const id = z.string().uuid().safeParse(req.params.id);
      if (!id.success) throw new HttpError(400, "ID inválido");
      await this.service.revogar(id.data, req.user);
      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  publico: Handler = async (req, res, next) => {
    try {
      const token = tokenSchema.safeParse(req.params.token);
      if (!token.success) throw new HttpError(404, "Compartilhamento não encontrado.");
      const resultado = await this.service.resolver(token.data);
      return res.status(200).json({ result: resultado });
    } catch (error) {
      next(error);
    }
  };
}

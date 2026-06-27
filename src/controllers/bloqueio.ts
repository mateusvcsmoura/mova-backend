import { Handler } from "express";
import { z } from "zod";

import { BloqueioService } from "../services/bloqueio.js";
import { HttpError } from "../errors/HttpError.js";
import {
  bloqueioQuerySchema,
  createBloqueioSchema,
} from "../schemas/bloqueio.schema.js";
import {
  getPaginationParams,
  toPaginationMeta,
} from "../shared/pagination.js";

export class BloqueioController {
  constructor(private readonly bloqueioService: BloqueioService) {}

  create: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const result = createBloqueioSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      const bloqueio = await this.bloqueioService.create({
        ...result.data,
        criadoPor: req.user.id,
      });
      return res.status(201).json({ result: bloqueio });
    } catch (error) {
      next(error);
    }
  };

  findById: Handler = async (req, res, next) => {
    try {
      const parsedId = z.string().uuid().safeParse(req.params.id);
      if (!parsedId.success) throw new HttpError(400, "ID inválido");

      const bloqueio = await this.bloqueioService.findById(parsedId.data);
      return res.status(200).json({ result: bloqueio });
    } catch (error) {
      next(error);
    }
  };

  // GET /locatario/:idLocatario — histórico (default) ou só ativos (?ativos=true).
  listByLocatario: Handler = async (req, res, next) => {
    try {
      const parsedId = z
        .string()
        .uuid()
        .safeParse(req.params.idLocatario);
      if (!parsedId.success) throw new HttpError(400, "ID inválido");

      const parsedQuery = bloqueioQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json({ errors: parsedQuery.error.format() });
      }

      if (parsedQuery.data.ativos) {
        const ativos = await this.bloqueioService.findAtivosByLocatario(
          parsedId.data,
        );
        return res.status(200).json({ result: ativos });
      }

      const pagination = getPaginationParams(req.query);
      const historico = await this.bloqueioService.findHistoricoByLocatario(
        parsedId.data,
        pagination,
      );
      return res.status(200).json({
        result: historico.data,
        pagination: toPaginationMeta(historico),
      });
    } catch (error) {
      next(error);
    }
  };

  revogar: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const parsedId = z.string().uuid().safeParse(req.params.id);
      if (!parsedId.success) throw new HttpError(400, "ID inválido");

      const bloqueio = await this.bloqueioService.revogar(
        parsedId.data,
        req.user.id,
      );
      return res.status(200).json({ result: bloqueio });
    } catch (error) {
      next(error);
    }
  };
}

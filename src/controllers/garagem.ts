import { Handler } from "express";
import { StatusVeiculo } from "@prisma/client";
import { GaragemService } from "../services/garagem.js";
import { HttpError } from "../errors/HttpError.js";
import {
  createGaragemSchema,
  updateGaragemSchema,
} from "../schemas/garagem.schema.js";
import { z } from "zod";
import { GaragemFilters } from "../repositories/contracts/garagem.contract.js";
import {
  getPaginationParams,
  toPaginationMeta,
} from "../shared/pagination.js";

export class GaragemController {
  constructor(private garagemService: GaragemService) {}

  private buildFilters(query: any): GaragemFilters {
    return {
      acessibilidade:
        query.acessibilidade !== undefined
          ? query.acessibilidade === "true"
          : undefined,
      idLocador: query.idLocador,
      nome: query.nome,
      capacidadeMin: query.capacidadeMin
        ? Number(query.capacidadeMin)
        : undefined,
      capacidadeMax: query.capacidadeMax
        ? Number(query.capacidadeMax)
        : undefined,
      comVagasDisponiveis:
        query.comVagasDisponiveis !== undefined
          ? query.comVagasDisponiveis === "true"
          : undefined,
    };
  }

  index: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const filters = this.buildFilters(req.query);
      const pagination = getPaginationParams(req.query);

      // Só passa filters se ao menos um campo foi informado
      const hasFilters = Object.values(filters).some((v) => v !== undefined);

      const garagens = await this.garagemService.list({
        requester: req.user,
        filters: hasFilters ? filters : undefined,
        pagination,
      });

      return res.status(200).json({
        result: garagens.data,
        pagination: toPaginationMeta(garagens),
      });
    } catch (error) {
      next(error);
    }
  };

  findById: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const result = z.string().uuid().safeParse(req.params.id);
      if (!result.success) throw new HttpError(400, "ID inválido");

      const garagem = await this.garagemService.findById(
        result.data,
        req.user,
      );
      return res.status(200).json({ result: garagem });
    } catch (error) {
      next(error);
    }
  };

  findVeiculos: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const result = z.string().uuid().safeParse(req.params.id);
      if (!result.success) throw new HttpError(400, "ID inválido");

      const status = z
        .nativeEnum(StatusVeiculo)
        .optional()
        .safeParse(req.query.status);
      if (!status.success) throw new HttpError(400, "Status inválido");

      const pagination = getPaginationParams(req.query);
      const veiculos = await this.garagemService.findVeiculosByGaragem(
        result.data,
        req.user,
        pagination,
        status.data ? { status: status.data } : undefined,
      );
      return res.status(200).json({
        result: veiculos.data,
        pagination: toPaginationMeta(veiculos),
      });
    } catch (error) {
      next(error);
    }
  };

  create: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const result = createGaragemSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      const garagem = await this.garagemService.create(result.data, req.user);
      return res.status(201).json({ result: garagem });
    } catch (error) {
      next(error);
    }
  };

  update: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const parsedId = z.string().uuid().safeParse(req.params.id);
      if (!parsedId.success) throw new HttpError(400, "ID inválido");

      const result = updateGaragemSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      const garagem = await this.garagemService.update(
        parsedId.data,
        result.data,
        req.user,
      );
      return res.status(200).json({ result: garagem });
    } catch (error) {
      next(error);
    }
  };

  delete: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const result = z.string().uuid().safeParse(req.params.id);
      if (!result.success) throw new HttpError(400, "ID inválido");

      await this.garagemService.delete(result.data, req.user);
      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  alocarVeiculo: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const parsedGaragemId = z.string().uuid().safeParse(req.params.garagemId);
      if (!parsedGaragemId.success) {
        throw new HttpError(400, "ID da garagem inválido");
      }

      const parsedVeiculoId = z.string().uuid().safeParse(req.params.veiculoId);
      if (!parsedVeiculoId.success) {
        throw new HttpError(400, "ID do veículo inválido");
      }

      await this.garagemService.alocarVeiculo(
        parsedGaragemId.data,
        parsedVeiculoId.data,
        req.user,
      );
      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  desalocarVeiculo: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const parsedGaragemId = z.string().uuid().safeParse(req.params.garagemId);
      if (!parsedGaragemId.success) {
        throw new HttpError(400, "ID da garagem inválido");
      }

      const parsedVeiculoId = z.string().uuid().safeParse(req.params.veiculoId);
      if (!parsedVeiculoId.success) {
        throw new HttpError(400, "ID do veículo inválido");
      }

      await this.garagemService.desalocarVeiculo(
        parsedGaragemId.data,
        parsedVeiculoId.data,
        req.user,
      );
      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

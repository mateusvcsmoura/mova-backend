import { Handler } from "express";
import { VeiculoService } from "../services/veiculo.js";
import { HttpError } from "../errors/HttpError.js";
import {
  createVeiculoSchema,
  updateVeiculoSchema,
} from "../schemas/veiculo.schema.js";
import { z } from "zod";
import { VeiculoFilters } from "../repositories/contracts/veiculo.contract.js";

export class VeiculoController {
  constructor(private veiculoService: VeiculoService) {}

  private buildFilters(query: any): VeiculoFilters {
    return {
      placa: query.placa,
      marca: query.marca,
      modelo: query.modelo,
      ano: query.ano ? Number(query.ano) : undefined,
      cambio: query.cambio,
      capacidade: query.capacidade
        ? Number(query.capacidade)
        : undefined,
      eletrico: query.eletrico
        ? query.eletrico === "true"
        : undefined,
      adaptado: query.adaptado
        ? query.adaptado === "true"
        : undefined,
    };
  }

  index: Handler = async (req, res, next) => {
    try {
      if (!req.user) {
        throw new HttpError(401, "Não autenticado");
      }

      const { id, cargo } = req.user;
      const filters = this.buildFilters(req.query);

      const query = {
        id,
        cargo,    
        filters
      }
      
      const veiculos = await this.veiculoService.list(query);

      return res.status(200).json({ result: veiculos });
    } catch (error) {
      next(error);
    }
  };

  findById: Handler = async (req, res, next) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id);

      if (!result.success) {
        throw new HttpError(400, "ID inválido");
      }

      const veiculo = await this.veiculoService.findById(result.data);

      return res.status(200).json({ result: veiculo });
    } catch (error) {
      next(error);
    }
  };

  findByLocadorId: Handler = async (req, res, next) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id_locador);

      if (!result.success) {
        throw new HttpError(400, "ID inválido");
      }

      const veiculos = await this.veiculoService.findByLocadorId(result.data);

      return res.status(200).json({ result: veiculos });
    } catch (error) {
      next(error);
    }
  };

  search: Handler = async (req, res, next) => {
    try {
      const filters = this.buildFilters(req.query);
      const result = await this.veiculoService.search(filters);

      return res.status(200).json({ result });
    } catch (error) {
      next(error);
    }
  };

  create: Handler = async (req, res, next) => {
    try {
      const result = createVeiculoSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          errors: result.error.format(),
        });
      }

      const data = result.data;

      const veiculo = await this.veiculoService.create(data);

      return res.status(201).json({ result: veiculo });
    } catch (error) {
      next(error);
    }
  };

  update: Handler = async (req, res, next) => {
    if (!req.params || !req.body)
      throw new HttpError(400, "Parâmetros ou corpo da requisição ausentes");

    try {
      const parsedId = z.string().uuid().safeParse(req.params.id);

      if (!parsedId.success) {
        throw new HttpError(400, "ID inválido");
      }

      const id = parsedId.data;

      const result = updateVeiculoSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          errors: result.error.format(),
        });
      }

      const data = result.data;

      const veiculo = await this.veiculoService.update(id, data);

      return res.status(201).json({ result: veiculo });
    } catch (error) {
      next(error);
    }
  };

  delete: Handler = async (req, res, next) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id);

      if (!result.success) {
        throw new HttpError(400, "ID inválido");
      }

      await this.veiculoService.delete(result.data);

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

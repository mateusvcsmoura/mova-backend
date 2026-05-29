import { Handler } from "express";
import { VeiculoService } from "../services/veiculo.js";
import { HttpError } from "../errors/HttpError.js";
import {
  createVeiculoSchema,
  createVeiculoLoteSchema,
  updateVeiculoSchema,
  updateModeloVeiculoSchema,
  updateModeloDoVeiculoSchema,
} from "../schemas/veiculo.schema.js";
import { z } from "zod";
import { VeiculoFilters } from "../repositories/contracts/veiculo.contract.js";

export class VeiculoController {
  constructor(private veiculoService: VeiculoService) {}

  // placa removida — não é mais um campo de VeiculoFilters
  private buildFilters(query: any): VeiculoFilters {
    return {
      idLocador: query.idLocador,
      marca: query.marca,
      modelo: query.modelo,
      ano: query.ano ? Number(query.ano) : undefined,
      cambio: query.cambio,
      capacidade: query.capacidade ? Number(query.capacidade) : undefined,
      eletrico:
        query.eletrico !== undefined ? query.eletrico === "true" : undefined,
      adaptado:
        query.adaptado !== undefined ? query.adaptado === "true" : undefined,
      garagemId: query.garagemId,
    };
  }

  index: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const { id, cargo } = req.user;
      const filters = this.buildFilters(req.query);

      // Só passa filters se ao menos um campo foi informado
      const hasFilters = Object.values(filters).some((v) => v !== undefined);

      const veiculos = await this.veiculoService.list({
        id,
        cargo,
        filters: hasFilters ? filters : undefined,
      });

      return res.status(200).json({ result: veiculos });
    } catch (error) {
      next(error);
    }
  };

  findById: Handler = async (req, res, next) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id);
      if (!result.success) throw new HttpError(400, "ID inválido");

      const veiculo = await this.veiculoService.findById(result.data);
      return res.status(200).json({ result: veiculo });
    } catch (error) {
      next(error);
    }
  };

  findByLocadorId: Handler = async (req, res, next) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id_locador);
      if (!result.success) throw new HttpError(400, "ID inválido");

      const veiculos = await this.veiculoService.findByLocadorId(result.data);
      return res.status(200).json({ result: veiculos });
    } catch (error) {
      next(error);
    }
  };

  create: Handler = async (req, res, next) => {
    try {
      const result = createVeiculoSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      const veiculo = await this.veiculoService.create(result.data);
      return res.status(201).json({ result: veiculo });
    } catch (error) {
      next(error);
    }
  };

  createLote: Handler = async (req, res, next) => {
    try {
      const result = createVeiculoLoteSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      const veiculos = await this.veiculoService.createLote(result.data);
      return res.status(201).json({ result: veiculos });
    } catch (error) {
      next(error);
    }
  };

  update: Handler = async (req, res, next) => {
    try {
      const parsedId = z.string().uuid().safeParse(req.params.id);
      if (!parsedId.success) throw new HttpError(400, "ID inválido");

      const result = updateVeiculoSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      const veiculo = await this.veiculoService.update(
        parsedId.data,
        result.data,
      );
      return res.status(200).json({ result: veiculo });
    } catch (error) {
      next(error);
    }
  };

  delete: Handler = async (req, res, next) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id);
      if (!result.success) throw new HttpError(400, "ID inválido");

      await this.veiculoService.delete(result.data);
      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  updateModelo: Handler = async (req, res, next) => {
    try {
      const parsedId = z.string().uuid().safeParse(req.params.id_modelo);
      if (!parsedId.success) {
        throw new HttpError(400, "ID do modelo inválido");
      }

      const result = updateModeloVeiculoSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      const modelo = await this.veiculoService.updateModelo(
        parsedId.data,
        result.data,
      );

      return res.status(200).json({ result: modelo });
    } catch (error) {
      next(error);
    }
  };

  // Troca o modelo de um veículo específico sem afetar os demais
  updateModeloDoVeiculo: Handler = async (req, res, next) => {
    try {
      const parsedId = z.string().uuid().safeParse(req.params.id_veiculo);
      if (!parsedId.success) {
        throw new HttpError(400, "ID do veículo inválido");
      }

      const result = updateModeloDoVeiculoSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      const veiculo = await this.veiculoService.updateModeloDoVeiculo(
        parsedId.data,
        result.data,
      );

      return res.status(200).json({ result: veiculo });
    } catch (error) {
      next(error);
    }
  };
}

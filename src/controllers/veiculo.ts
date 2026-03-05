import { Handler } from "express";
import { VeiculoService } from "../services/veiculo.js";
import { HttpError } from "../errors/HttpError.js";
import { VeiculoStatus } from "../repositories/contracts/veiculo.contract.js";
import {
  createVeiculoSchema,
  updateVeiculoSchema,
} from "../schemas/veiculo.schema.js";

export class VeiculoController {
  constructor(private veiculoService: VeiculoService) {}

  index: Handler = async (req, res, next) => {
    try {
      const veiculos = await this.veiculoService.findAll();

      return res.status(200).json({ result: veiculos });
    } catch (error) {
      next(error);
    }
  };

  findById: Handler = async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== "string") {
        throw new HttpError(
          400,
          "ID do veículo é obrigatório e deve ser uma string",
        );
      }

      const veiculo = await this.veiculoService.findById(id);

      return res.status(200).json({ result: veiculo });
    } catch (error) {
      next(error);
    }
  };

  findByLocadorId: Handler = async (req, res, next) => {
    try {
      const { id_locador } = req.params;

      if (!id_locador || typeof id_locador !== "string") {
        throw new HttpError(
          400,
          "ID do locador é obrigatório e deve ser uma string",
        );
      }

      const veiculos = await this.veiculoService.findByLocadorId(id_locador);

      return res.status(200).json({ result: veiculos });
    } catch (error) {
      next(error);
    }
  };

  search: Handler = async (req, res, next) => {
    try {
      const filters = {
        placa: req.query.placa as string | undefined,
        marca: req.query.marca as string | undefined,
        modelo: req.query.modelo as string | undefined,
        ano: req.query.ano ? Number(req.query.ano) : undefined,
        cambio: req.query.cambio as string | undefined,
        capacidade: req.query.capacidade
          ? Number(req.query.capacidade)
          : undefined,
        status: req.query.status as VeiculoStatus | undefined,
        eletrico: req.query.eletrico
          ? req.query.eletrico === "true"
          : undefined,
        adaptado: req.query.adaptado
          ? req.query.adaptado === "true"
          : undefined,
      };

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
    try {
      const { id } = req.params;

      if (!id || typeof id !== "string") {
        throw new HttpError(
          400,
          "ID do veículo é obrigatório e deve ser uma string",
        );
      }

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
      const { id } = req.params;

      if (!id || typeof id !== "string") {
        throw new HttpError(
          400,
          "ID do veículo é obrigatório e deve ser uma string",
        );
      }

      await this.veiculoService.delete(id);

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

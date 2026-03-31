import { Handler } from "express";
import { VeiculoService } from "../services/veiculo.js";
import { HttpError } from "../errors/HttpError.js";
import {
  createVeiculoSchema,
  updateVeiculoSchema,
} from "../schemas/veiculo.schema.js";
import { StatusVeiculo } from "@prisma/client";
import { z } from "zod";

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
      const filters = {
        placa: req.query.placa as string | undefined,
        marca: req.query.marca as string | undefined,
        modelo: req.query.modelo as string | undefined,
        ano: req.query.ano ? Number(req.query.ano) : undefined,
        cambio: req.query.cambio as string | undefined,
        capacidade: req.query.capacidade
          ? Number(req.query.capacidade)
          : undefined,
        status: req.query.status as StatusVeiculo | undefined,
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

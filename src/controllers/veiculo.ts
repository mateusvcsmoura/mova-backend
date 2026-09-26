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
import { Cargo, CategoriaVeiculo } from "@prisma/client";
import {
  PublicVeiculoResponse,
  VeiculoFilters,
  VeiculoResponse,
} from "../repositories/contracts/veiculo.contract.js";
import {
  getPaginationParams,
  toPaginationMeta,
} from "../shared/pagination.js";

export class VeiculoController {
  constructor(private veiculoService: VeiculoService) {}

  private paraCatalogo(veiculo: VeiculoResponse): PublicVeiculoResponse {
    const modelo = veiculo.modeloVeiculo;
    return {
      id: veiculo.id,
      status: veiculo.status,
      garagemId: veiculo.garagemId,
      garagem: veiculo.garagem
        ? {
            id: veiculo.garagem.id,
            nome: veiculo.garagem.nome,
            status: veiculo.garagem.status,
          }
        : null,
      modeloVeiculo: {
        marca: modelo.marca,
        modelo: modelo.modelo,
        ano: modelo.ano,
        cambio: modelo.cambio,
        capacidade: modelo.capacidade,
        eletrico: modelo.eletrico,
        adaptado: modelo.adaptado,
        categoria: modelo.categoria,
        valorDiaria: modelo.valorDiaria,
      },
    };
  }

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
      // Categoria (RF07): só aceita valores válidos do enum; ignora inválidos.
      categoria: Object.values(CategoriaVeiculo).includes(query.categoria)
        ? (query.categoria as CategoriaVeiculo)
        : undefined,
      pcd: query.pcd === undefined ? undefined : query.pcd === "true",
      garagemId: query.garagemId,
    };
  }

  index: Handler = async (req, res, next) => {
    try {
      const filters = this.buildFilters(req.query);
      const pagination = getPaginationParams(req.query);
      const hasFilters = Object.values(filters).some((v) => v !== undefined);
      const catalogoPublico = !req.user || req.user.cargo === Cargo.LOCATARIO;
      const veiculos = catalogoPublico
        ? await this.veiculoService.listCatalog(
            hasFilters ? filters : {},
            pagination,
          )
        : await this.veiculoService.list({
            id: req.user!.id,
            cargo: req.user!.cargo,
            filters: hasFilters ? filters : undefined,
            pagination,
          });

      return res.status(200).json({
        result: catalogoPublico
          ? veiculos.data.map((veiculo) => this.paraCatalogo(veiculo))
          : veiculos.data,
        pagination: toPaginationMeta(veiculos),
      });
    } catch (error) {
      next(error);
    }
  };

  frota: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const pagination = getPaginationParams(req.query);
      const veiculos = await this.veiculoService.listFrota(req.user, pagination);

      return res.status(200).json({
        result: veiculos.data,
        pagination: toPaginationMeta(veiculos),
      });
    } catch (error) {
      next(error);
    }
  };

  findById: Handler = async (req, res, next) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id);
      if (!result.success) throw new HttpError(400, "ID inválido");

      if (req.user?.cargo === Cargo.LOCADOR || req.user?.cargo === Cargo.ADMIN) {
        const veiculo = await this.veiculoService.findById(result.data, req.user);
        return res.status(200).json({ result: veiculo });
      }

      const veiculo = await this.veiculoService.findCatalogById(result.data);
      return res.status(200).json({ result: this.paraCatalogo(veiculo) });
    } catch (error) {
      next(error);
    }
  };

  findByLocadorId: Handler = async (req, res, next) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id_locador);
      if (!result.success) throw new HttpError(400, "ID inválido");

      const pagination = getPaginationParams(req.query);
      const veiculos = await this.veiculoService.findByLocadorId(
        result.data,
        pagination,
      );
      return res.status(200).json({
        result: veiculos.data.map((veiculo) => this.paraCatalogo(veiculo)),
        pagination: toPaginationMeta(veiculos),
      });
    } catch (error) {
      next(error);
    }
  };

  create: Handler = async (req, res, next) => {
    try {
      const result = createVeiculoSchema.parse(req.body);

      if (!req.user) throw new HttpError(401, "Não autenticado");
      const veiculo = await this.veiculoService.create(result, req.user);
      return res.status(201).json({ result: veiculo });
    } catch (error) {
      next(error);
    }
  };

  createLote: Handler = async (req, res, next) => {
    try {
      const result = createVeiculoLoteSchema.parse(req.body);

      if (!req.user) throw new HttpError(401, "Não autenticado");
      const veiculos = await this.veiculoService.createLote(
        result,
        req.user,
      );
      return res.status(201).json({ result: veiculos });
    } catch (error) {
      next(error);
    }
  };

  update: Handler = async (req, res, next) => {
    try {
      const parsedId = z.string().uuid().safeParse(req.params.id);
      if (!parsedId.success) throw new HttpError(400, "ID inválido");

      const result = updateVeiculoSchema.parse(req.body);

      if (!req.user) throw new HttpError(401, "Não autenticado");
      const veiculo = await this.veiculoService.update(
        parsedId.data,
        result,
        req.user,
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

      if (!req.user) throw new HttpError(401, "Não autenticado");
      await this.veiculoService.delete(result.data, req.user);
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

      const result = updateModeloVeiculoSchema.parse(req.body);

      if (!req.user) throw new HttpError(401, "Não autenticado");
      const modelo = await this.veiculoService.updateModelo(
        parsedId.data,
        result,
        req.user,
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

      const result = updateModeloDoVeiculoSchema.parse(req.body);

      if (!req.user) throw new HttpError(401, "Não autenticado");
      const veiculo = await this.veiculoService.updateModeloDoVeiculo(
        parsedId.data,
        result,
        req.user,
      );

      return res.status(200).json({ result: veiculo });
    } catch (error) {
      next(error);
    }
  };
}

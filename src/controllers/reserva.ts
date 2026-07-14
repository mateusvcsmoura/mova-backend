import { Handler } from "express";
import { z } from "zod";

import { ReservaService } from "../services/reserva.js";
import { HttpError } from "../errors/HttpError.js";
import {
  createReservaSchema,
  desbloquearReservaSchema,
  desbloquearQrSchema,
  reservaQuerySchema,
  updateReservaSchema,
} from "../schemas/reserva.schema.js";
import { createCondutorSchema } from "../schemas/condutor.schema.js";
import { ReservaFilters } from "../repositories/contracts/reserva.contract.js";
import {
  getPaginationParams,
  toPaginationMeta,
} from "../shared/pagination.js";

export class ReservaController {
  constructor(private reservaService: ReservaService) {}

  private buildFilters(query: any): ReservaFilters {
    return {
      idVeiculo: query.idVeiculo,
      idLocatario: query.idLocatario,
      status: query.status,
      statusPagamento: query.statusPagamento,
    };
  }

  index: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const parsedQuery = reservaQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        return res.status(400).json({ errors: parsedQuery.error.format() });
      }

      const { id, cargo } = req.user;
      const filters = this.buildFilters(parsedQuery.data);
      const pagination = getPaginationParams(req.query);

      // Só passa filters se ao menos um campo foi informado
      const hasFilters = Object.values(filters).some((v) => v !== undefined);

      const reservas = await this.reservaService.list({
        id,
        cargo,
        filters: hasFilters ? filters : undefined,
        pagination,
      });

      return res.status(200).json({
        result: reservas.data,
        pagination: toPaginationMeta(reservas),
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

      const reserva = await this.reservaService.findById(result.data, req.user);
      return res.status(200).json({ result: reserva });
    } catch (error) {
      next(error);
    }
  };

  findByLocatarioId: Handler = async (req, res, next) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id_locatario);
      if (!result.success) throw new HttpError(400, "ID inválido");

      const pagination = getPaginationParams(req.query);
      const reservas = await this.reservaService.findByLocatarioId(
        result.data,
        pagination,
      );
      return res.status(200).json({
        result: reservas.data,
        pagination: toPaginationMeta(reservas),
      });
    } catch (error) {
      next(error);
    }
  };

  findByVeiculoId: Handler = async (req, res, next) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id_veiculo);
      if (!result.success) throw new HttpError(400, "ID inválido");

      const pagination = getPaginationParams(req.query);
      const reservas = await this.reservaService.findByVeiculoId(
        result.data,
        pagination,
      );
      return res.status(200).json({
        result: reservas.data,
        pagination: toPaginationMeta(reservas),
      });
    } catch (error) {
      next(error);
    }
  };

  create: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const result = createReservaSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      const reserva = await this.reservaService.create(result.data, req.user);
      return res.status(201).json({ result: reserva });
    } catch (error) {
      next(error);
    }
  };

  update: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const parsedId = z.string().uuid().safeParse(req.params.id);
      if (!parsedId.success) throw new HttpError(400, "ID inválido");

      const result = updateReservaSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      const reserva = await this.reservaService.update(
        parsedId.data,
        result.data,
        req.user,
      );
      return res.status(200).json({ result: reserva });
    } catch (error) {
      next(error);
    }
  };

  cancelar: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const parsedId = z.string().uuid().safeParse(req.params.id);
      if (!parsedId.success) throw new HttpError(400, "ID inválido");

      const reserva = await this.reservaService.cancelarReserva(
        parsedId.data,
        req.user,
      );
      return res.status(200).json({ result: reserva });
    } catch (error) {
      next(error);
    }
  };

  devolver: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const parsedId = z.string().uuid().safeParse(req.params.id);
      if (!parsedId.success) throw new HttpError(400, "ID inválido");

      const reserva = await this.reservaService.devolverReserva(
        parsedId.data,
        req.user,
      );
      return res.status(200).json({ result: reserva });
    } catch (error) {
      next(error);
    }
  };

  delete: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const result = z.string().uuid().safeParse(req.params.id);
      if (!result.success) throw new HttpError(400, "ID inválido");

      await this.reservaService.delete(result.data, req.user);
      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  desbloquear: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const parsedId = z.string().uuid().safeParse(req.params.id);
      if (!parsedId.success) throw new HttpError(400, "ID inválido");

      const result = desbloquearReservaSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      const { codigo, latitude, longitude } = result.data;
      const coord =
        latitude !== undefined && longitude !== undefined
          ? { latitude, longitude }
          : undefined;
      const reserva = await this.reservaService.usarCodigoDesbloqueio(
        parsedId.data,
        codigo,
        req.user,
        coord,
      );
      return res.status(200).json({ result: reserva });
    } catch (error) {
      next(error);
    }
  };

  gerarQrDesbloqueio: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const parsedId = z.string().uuid().safeParse(req.params.id);
      if (!parsedId.success) throw new HttpError(400, "ID inválido");

      const result = await this.reservaService.gerarQrDesbloqueio(
        parsedId.data,
        req.user,
      );
      return res.status(200).json({ result });
    } catch (error) {
      next(error);
    }
  };

  desbloquearQr: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const parsedId = z.string().uuid().safeParse(req.params.id);
      if (!parsedId.success) throw new HttpError(400, "ID inválido");

      const result = desbloquearQrSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      const { qr, latitude, longitude } = result.data;
      const coord =
        latitude !== undefined && longitude !== undefined
          ? { latitude, longitude }
          : undefined;
      const reserva = await this.reservaService.usarQrDesbloqueio(
        parsedId.data,
        qr,
        req.user,
        coord,
      );
      return res.status(200).json({ result: reserva });
    } catch (error) {
      next(error);
    }
  };

  // ── Condutores adicionais (RF12) ──────────────────────────────────────────

  adicionarCondutor: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const parsedId = z.string().uuid().safeParse(req.params.id);
      if (!parsedId.success) throw new HttpError(400, "ID inválido");

      const result = createCondutorSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      const condutor = await this.reservaService.adicionarCondutor(
        parsedId.data,
        result.data,
        req.user,
      );
      return res.status(201).json({ result: condutor });
    } catch (error) {
      next(error);
    }
  };

  listarCondutores: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const parsedId = z.string().uuid().safeParse(req.params.id);
      if (!parsedId.success) throw new HttpError(400, "ID inválido");

      const condutores = await this.reservaService.listarCondutores(
        parsedId.data,
        req.user,
      );
      return res.status(200).json({ result: condutores });
    } catch (error) {
      next(error);
    }
  };

  removerCondutor: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");

      const parsedId = z.string().uuid().safeParse(req.params.id);
      if (!parsedId.success) throw new HttpError(400, "ID inválido");

      const parsedCondutor = z
        .string()
        .uuid()
        .safeParse(req.params.id_condutor);
      if (!parsedCondutor.success) {
        throw new HttpError(400, "ID do condutor inválido");
      }

      await this.reservaService.removerCondutor(
        parsedId.data,
        parsedCondutor.data,
        req.user,
      );
      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

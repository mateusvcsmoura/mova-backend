import { Handler } from "express";

import { LocadorDashboardService } from "../services/locador-dashboard.js";
import { HttpError } from "../errors/HttpError.js";

export class LocadorDashboardController {
  constructor(private readonly service: LocadorDashboardService) {}

  // idLocador vem sempre do token (req.user.id) — cliente nunca informa o dono.
  reservas: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const result = await this.service.relatorioReservas(req.user.id);
      return res.status(200).json({ result });
    } catch (error) {
      next(error);
    }
  };

  financeiro: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const result = await this.service.relatorioFinanceiro(req.user.id);
      return res.status(200).json({ result });
    } catch (error) {
      next(error);
    }
  };

  utilizacao: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const result = await this.service.relatorioUtilizacao(req.user.id);
      return res.status(200).json({ result });
    } catch (error) {
      next(error);
    }
  };

  frota: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const result = await this.service.frotaDashboard(req.user.id);
      return res.status(200).json({ result });
    } catch (error) {
      next(error);
    }
  };
}

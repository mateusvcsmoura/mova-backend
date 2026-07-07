import { Handler } from "express";
import { z } from "zod";

import { LgpdService } from "../services/lgpd.js";
import { HttpError } from "../errors/HttpError.js";

export class LgpdController {
  constructor(private lgpdService: LgpdService) {}

  // Titular = :id quando informado (rota ADMIN/titular), senão o próprio autor
  // autenticado (rotas /meus-dados, /anonimizar, /acessos).
  private resolverTitular(req: Parameters<Handler>[0]): string {
    if (req.params.id !== undefined) {
      const parsed = z.string().uuid().safeParse(req.params.id);
      if (!parsed.success) throw new HttpError(400, "ID inválido");
      return parsed.data;
    }
    return req.user!.id;
  }

  exportar: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const idTitular = this.resolverTitular(req);
      const dados = await this.lgpdService.exportar(idTitular, req.user);
      return res.status(200).json({ result: dados });
    } catch (error) {
      next(error);
    }
  };

  anonimizar: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const idTitular = this.resolverTitular(req);
      const result = await this.lgpdService.anonimizar(idTitular, req.user);
      return res.status(200).json({ result });
    } catch (error) {
      next(error);
    }
  };

  acessos: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const idTitular = this.resolverTitular(req);
      const result = await this.lgpdService.listarAcessos(idTitular, req.user);
      return res.status(200).json({ result });
    } catch (error) {
      next(error);
    }
  };
}

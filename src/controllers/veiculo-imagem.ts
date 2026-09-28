import { Handler } from "express";
import { z } from "zod";

import { HttpError } from "../errors/HttpError.js";
import { VeiculoImagemService } from "../services/veiculo-imagem.js";

const uuid = z.string().uuid();

export class VeiculoImagemController {
  constructor(private readonly service: VeiculoImagemService) {}

  listar: Handler = async (req, res, next) => {
    try {
      const id = uuid.parse(req.params.id);
      const result = await this.service.listar(id, req.user);
      return res.status(200).json({ result });
    } catch (error) {
      next(error);
    }
  };

  criar: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const id = uuid.parse(req.params.id);
      const contentType = String(req.headers["content-type"] ?? "").split(";", 1)[0];
      const altText = typeof req.headers["x-image-alt"] === "string" ? req.headers["x-image-alt"] : undefined;
      const result = await this.service.criar(id, req.body as Buffer, contentType, altText, req.user);
      return res.status(201).json({ result });
    } catch (error) {
      next(error);
    }
  };

  reordenar: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const id = uuid.parse(req.params.id);
      const body = z.object({ imagemIds: z.array(uuid) }).parse(req.body);
      const result = await this.service.reordenar(id, body, req.user);
      return res.status(200).json({ result });
    } catch (error) {
      next(error);
    }
  };

  definirCapa: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const id = uuid.parse(req.params.id);
      const imagemId = uuid.parse(req.params.imagemId);
      const result = await this.service.definirCapa(id, imagemId, req.user);
      return res.status(200).json({ result });
    } catch (error) {
      next(error);
    }
  };

  excluir: Handler = async (req, res, next) => {
    try {
      if (!req.user) throw new HttpError(401, "Não autenticado");
      const id = uuid.parse(req.params.id);
      const imagemId = uuid.parse(req.params.imagemId);
      await this.service.excluir(id, imagemId, req.user);
      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

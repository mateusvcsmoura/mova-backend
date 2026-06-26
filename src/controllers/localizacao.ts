import { Handler } from "express";
import { z } from "zod";

import { LocalizacaoService } from "../services/localizacao.js";
import { HttpError } from "../errors/HttpError.js";
import { createLocalizacaoSchema } from "../schemas/localizacao.schema.js";

export class LocalizacaoController {
  constructor(private localizacaoService: LocalizacaoService) {}

  registrar: Handler = async (req, res, next) => {
    try {
      const result = createLocalizacaoSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ errors: result.error.format() });
      }

      const localizacao = await this.localizacaoService.registrar(result.data);
      return res.status(201).json({ result: localizacao });
    } catch (error) {
      next(error);
    }
  };

  historico: Handler = async (req, res, next) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id_veiculo);
      if (!result.success) throw new HttpError(400, "ID inválido");

      const localizacoes = await this.localizacaoService.findHistorico(
        result.data,
      );
      return res.status(200).json({ result: localizacoes });
    } catch (error) {
      next(error);
    }
  };

  ultima: Handler = async (req, res, next) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id_veiculo);
      if (!result.success) throw new HttpError(400, "ID inválido");

      const localizacao = await this.localizacaoService.findUltima(result.data);
      return res.status(200).json({ result: localizacao });
    } catch (error) {
      next(error);
    }
  };
}

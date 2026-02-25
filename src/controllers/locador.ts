import { LocadorService } from "../services/locador.js";
import { Handler, NextFunction } from "express";
import { HttpError } from "../errors/HttpError.js";

export class LocadorController {
  constructor(private readonly locadorService: LocadorService) {}

  index: Handler = async (req, res, next: NextFunction) => {
    try {
      const contas = await this.locadorService.findAll();

      return res.status(200).json({ result: contas });
    } catch (error) {
      next(error);
    }
  };

  findById: Handler = async (req, res, next: NextFunction) => {
    try {
      const { id } = req.params;
      const conta = await this.locadorService.findById(Number(id));

      return res.status(200).json({ result: conta });
    } catch (error) {
      next(error);
    }
  };

  findByCnpj: Handler = async (req, res, next: NextFunction) => {
    try {
      const { cnpj } = req.params;

      if (cnpj && typeof cnpj !== "string") {
        throw new HttpError(400, "CNPJ deve ser uma string");
      }

      const conta = await this.locadorService.findByCnpj(cnpj);

      return res.status(200).json({ result: conta });
    } catch (error) {
      next(error);
    }
  };

  findByNome: Handler = async (req, res, next: NextFunction) => {
    try {
      const { nome } = req.params;

      if (nome && typeof nome !== "string") {
        throw new HttpError(400, "Nome deve ser uma string");
      }

      const conta = await this.locadorService.findByName(nome);

      return res.status(200).json({ result: conta });
    } catch (error) {
      next(error);
    }
  };
}

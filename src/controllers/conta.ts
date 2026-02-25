import { Handler, NextFunction } from "express";
import { ContaService } from "../services/conta.js";
import { HttpError } from "../errors/HttpError.js";

export class ContaController {
  constructor(private readonly contaService: ContaService) {}

  index: Handler = async (req, res, next: NextFunction) => {
    try {
      const contas = await this.contaService.findAll();

      return res.status(200).json({ result: contas });
    } catch (error) {
      next(error);
    }
  };

  findByEmail: Handler = async (req, res, next: NextFunction) => {
    if (!req.query) throw new HttpError(400, "Parâmetros de consulta ausentes");

    try {
      const { email } = req.query;

      if (!email || typeof email !== "string") {
        throw new HttpError(400, "Email inválido ou não informado");
      }
      const conta = await this.contaService.findByEmail(email);

      return res.status(200).json({ result: conta });
    } catch (error) {
      next(error);
    }
  };

  findById: Handler = async (req, res, next: NextFunction) => {
    if (!req.params) throw new HttpError(400, "Parâmetros ausentes");

    try {
      const { id } = req.params;

      if (!id || typeof id !== "string") {
        throw new HttpError(400, "ID inválido ou não informado");
      }

      const conta = await this.contaService.findById(id);

      return res.status(200).json({ result: conta });
    } catch (error) {
      next(error);
    }
  };

  create: Handler = async (req, res, next: NextFunction) => {
    if (!req.body) throw new HttpError(400, "Corpo da requisição ausente");

    try {
      const { nome, email, telefone, senha } = req.body;

      if (
        !email ||
        typeof email !== "string" ||
        !senha ||
        typeof senha !== "string" || 
        !nome ||
        typeof nome !== "string"
      ) {
        throw new HttpError(400, "Email inválido ou não informado");
      }

      const conta = await this.contaService.create({
        nome,
        email,
        telefone,
        senha,
      });

      return res.status(201).json({ result: conta });
    } catch (error) {
      next(error);
    }
  };
}

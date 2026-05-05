import { Handler, NextFunction } from "express";
import { ContaService } from "../services/conta.js";
import { HttpError } from "../errors/HttpError.js";
import {
  changePasswordSchema,
  createContaSchema,
  loginSchema,
  updateContaSchema,
} from "../schemas/conta.schema.js";

import { z } from "zod";
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

  findById: Handler = async (req, res, next) => {
    try {
      const result = z.string().uuid().safeParse(req.params.id);

      if (!result.success) {
        throw new HttpError(400, "ID inválido");
      }

      const conta = await this.contaService.findById(result.data);

      return res.status(200).json({ result: conta });
    } catch (error) {
      next(error);
    }
  };

  getCurrentAccount: Handler = async (req, res, next) => {
    try {
      const result = z.string().uuid().safeParse(req.user?.id);

      if (!result.success) {
        throw new HttpError(400, "ID inválido");
      }

      const conta = await this.contaService.getCurrentAccount(result.data);

      return res.status(200).json({ result: { conta } });
    } catch (error) {
      next(error);
    }
  };

  register: Handler = async (req, res, next: NextFunction) => {
    if (!req.body) throw new HttpError(400, "Corpo da requisição ausente");

    try {
      const result = createContaSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          errors: result.error.format(),
        });
      }

      const data = result.data;

      const { conta, token } = await this.contaService.register(data);

      return res.status(201).json({ result: { conta, token } });
    } catch (error) {
      next(error);
    }
  };

  login: Handler = async (req, res, next: NextFunction) => {
    if (!req.body) throw new HttpError(400, "Corpo da requisição ausente");

    try {
      const result = loginSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          errors: result.error.format(),
        });
      }

      const data = result.data;
      const { token } = await this.contaService.login(data.email, data.senha);

      return res.status(200).json({ result: { token } });
    } catch (error) {
      next(error);
    }
  };

  updateProfile: Handler = async (req, res, next: NextFunction) => {
    if (!req.body) throw new HttpError(400, "Corpo da requisição ausente");

    try {
      const result = updateContaSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          errors: result.error.format(),
        });
      }

      const data = result.data;

      const userId = req.user?.id;

      if (!userId) {
        throw new HttpError(401, "Não autenticado");
      }

      await this.contaService.update(userId, data);

      return res.status(200).json({ result: "Perfil atualizado com sucesso" });
    } catch (error) {
      next(error);
    }
  };

  changePassword: Handler = async (req, res, next: NextFunction) => {
    if (!req.body) throw new HttpError(400, "Corpo da requisição ausente");

    try {
      const result = changePasswordSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          errors: result.error.format(),
        });
      }

      const data = result.data;

      const userId = req.user?.id;

      if (!userId) {
        throw new HttpError(401, "Não autenticado");
      }

      await this.contaService.changePassword(
        userId,
        data.senhaAtual,
        data.novaSenha,
      );

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  deleteAccount: Handler = async (req, res, next: NextFunction) => {
    try {
      const result = z.string().uuid().safeParse(req.user?.id);

      if (!result.success) {
        throw new HttpError(400, "ID inválido");
      }

      await this.contaService.delete(result.data);

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  create: Handler = async (req, res, next: NextFunction) => {
    if (!req.body) throw new HttpError(400, "Corpo da requisição ausente");

    try {
      const result = createContaSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          errors: result.error.format(),
        });
      }

      const data = result.data;
      const conta = await this.contaService.create(data);

      return res.status(201).json({ result: conta });
    } catch (error) {
      next(error);
    }
  };

  update: Handler = async (req, res, next: NextFunction) => {
    if (!req.params || !req.body)
      throw new HttpError(400, "Parâmetros ou corpo da requisição ausentes");

    try {
      const parsedId = z.string().uuid().safeParse(req.params.id);

      if (!parsedId.success) {
        throw new HttpError(400, "ID inválido");
      }

      const id = parsedId.data;

      const result = updateContaSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          errors: result.error.format(),
        });
      }

      const data = result.data;
      const conta = await this.contaService.update(id, data);

      return res.status(200).json({ result: conta });
    } catch (error) {
      next(error);
    }
  };

  delete: Handler = async (req, res, next: NextFunction) => {
    if (!req.params) throw new HttpError(400, "Parâmetros ausentes");

    try {
      const result = z.string().uuid().safeParse(req.params.id);

      if (!result.success) {
        throw new HttpError(400, "ID inválido");
      }

      await this.contaService.delete(result.data);

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

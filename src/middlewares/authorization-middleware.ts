import { Cargo } from "@prisma/client";
import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth-middleware.js";
import { HttpError } from "../errors/HttpError.js";
import { ErrorCode } from "../i18n/index.js";

export function authorize(...cargosPermitidos: Cargo[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return next(new HttpError(401, "Não autenticado", ErrorCode.UNAUTHENTICATED));
    }

    // Nenhum cargo especificado = qualquer usuário autenticado pode acessar
    if (cargosPermitidos.length === 0) {
      return next();
    }

    if (!cargosPermitidos.includes(user.cargo)) {
      return next(new HttpError(403, "Acesso negado", ErrorCode.FORBIDDEN));
    }

    return next();
  };
}

export function authorizeOwner(paramName = "id") {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return next(new HttpError(401, "Não autenticado", ErrorCode.UNAUTHENTICATED));
    }

    if (user.cargo === Cargo.ADMIN) {
      return next();
    }

    const resourceOwnerId = req.params[paramName];

    if (!resourceOwnerId) {
      return next(
        new HttpError(
          400,
          `Parâmetro '${paramName}' não encontrado na rota`,
          ErrorCode.VALIDATION_ERROR,
        ),
      );
    }

    if (user.id !== resourceOwnerId) {
      return next(new HttpError(403, "Acesso negado", ErrorCode.FORBIDDEN));
    }

    return next();
  };
}

import { Cargo } from "@prisma/client";
import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth-middleware.js";
import { HttpError } from "../errors/HttpError.js";
import { ErrorCode } from "../i18n/index.js";

/**
 * Middleware de autorização baseado em cargos (RBAC).
 *
 * Deve ser usado APÓS o `authMiddleware`, que popula `req.user`.
 *
 * @example
 * // Rota acessível apenas por ADMIN
 * router.delete("/conta/:id", authMiddleware, authorize(Cargo.ADMIN), deleteContaHandler);
 *
 * @example
 * // Rota acessível por LOCADOR ou ADMIN
 * router.post("/veiculo", authMiddleware, authorize(Cargo.LOCADOR, Cargo.ADMIN), createVeiculoHandler);
 *
 * @example
 * // Rota acessível por qualquer usuário autenticado
 * router.get("/perfil", authMiddleware, authorize(), getPerfilHandler);
 */
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

/**
 * Middleware de autorização que garante que o usuário autenticado
 * só acessa/modifica seus próprios recursos (via parâmetro de rota).
 *
 * Admins ignoram essa restrição e sempre passam.
 *
 * @param paramName - Nome do parâmetro de rota com o ID do dono do recurso.
 *                    Padrão: "id"
 *
 * @example
 * // LOCATARIO só acessa seus próprios dados; ADMIN acessa qualquer um
 * router.get("/locatario/:id", authMiddleware, authorizeOwner(), getLocatarioHandler);
 *
 * @example
 * // Parâmetro customizado
 * router.put("/reserva/:reservaId/...", authMiddleware, authorizeOwner("reservaId"), ...);
 */
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

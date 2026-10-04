import { Cargo } from "@prisma/client";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ErrorCode } from "../i18n/index.js";
import { HttpError } from "../errors/HttpError.js";
import { prisma } from "../database/prisma.js";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    cargo: Cargo;
  };
}

function isCargo(value: any): value is Cargo {
  return Object.values(Cargo).includes(value);
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return next(new HttpError(401, "Não autenticado", ErrorCode.UNAUTHENTICATED));
  }

  let decoded: jwt.JwtPayload | string;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return next(new HttpError(401, "Token inválido", ErrorCode.INVALID_TOKEN));
  }

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("id" in decoded) ||
    !("cargo" in decoded) ||
    typeof (decoded as any).id !== "string" ||
    !isCargo((decoded as any).cargo)
  ) {
    return next(new HttpError(401, "Token inválido", ErrorCode.INVALID_TOKEN));
  }

  req.user = {
    id: (decoded as any).id,
    cargo: (decoded as any).cargo,
  };

  const conta = await prisma.conta.findUnique({
    where: { id: req.user.id },
    select: { anonimizadoEm: true },
  });
  if (!conta || conta.anonimizadoEm) {
    return next(
      new HttpError(
        401,
        conta
          ? "Sessão revogada porque a conta foi anonimizada"
          : "Sessão revogada porque a conta não existe mais",
        ErrorCode.SESSION_REVOKED,
      ),
    );
  }

  return next();
}


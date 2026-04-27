import { Cargo } from "@prisma/client";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    cargo: Cargo;
  };
}

function isCargo(value: any): value is Cargo {
  return Object.values(Cargo).includes(value);
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("id" in decoded) ||
      !("cargo" in decoded) ||
      typeof (decoded as any).id !== "string" ||
      !isCargo((decoded as any).cargo)
    ) {
      return res.status(401).json({ error: "Token inválido" });
    }

    req.user = {
      id: (decoded as any).id,
      cargo: (decoded as any).cargo,
    };

    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}


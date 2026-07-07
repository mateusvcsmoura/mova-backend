import { randomUUID } from "node:crypto";
import { Request, Response, NextFunction } from "express";

import { logger } from "../shared/logger.js";

// Observabilidade básica de requisições:
//  - request id: reutiliza o header X-Request-Id recebido (ex.: propagado por
//    um gateway/proxy) ou gera um UUID; anexa em req.id e devolve no header da
//    resposta para correlação ponta a ponta.
//  - tempo de execução: mede a duração da requisição com hrtime (monotônico).
//  - log estruturado: uma linha JSON por requisição concluída (silenciada em
//    teste pelo próprio logger).
export function observability(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers["x-request-id"];
  const requestId =
    typeof incoming === "string" && incoming.length > 0
      ? incoming
      : randomUUID();

  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);

  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs =
      Math.round(Number(process.hrtime.bigint() - start) / 1e3) / 1e3;

    logger.info("request", {
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs,
    });
  });

  next();
}

import { randomUUID } from "node:crypto";
import { Request, Response, NextFunction } from "express";

import { logger } from "../shared/logger.js";

export function observability(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers["x-request-id"];
  const authorization = req.headers.authorization;
  const bearerToken =
    typeof authorization === "string"
      ? authorization.replace(/^Bearer\s+/i, "")
      : undefined;
  const validIncoming =
    typeof incoming === "string" &&
    incoming.length <= 128 &&
    /^[A-Za-z0-9._:-]+$/.test(incoming) &&
    !/^[^.]+\.[^.]+\.[^.]+$/.test(incoming) &&
    incoming !== authorization &&
    incoming !== bearerToken;
  const requestId = validIncoming ? incoming : randomUUID();

  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);

  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs =
      Math.round(Number(process.hrtime.bigint() - start) / 1e3) / 1e3;

    logger.info("request", {
      requestId,
      method: req.method,
      status: res.statusCode,
      durationMs,
    });
  });

  next();
}

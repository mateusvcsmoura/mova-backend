import { Router } from "express";

import { prisma } from "../../database/prisma.js";
import { logger } from "../../shared/logger.js";

// Ping de banco: consulta trivial que falha se a conexão estiver indisponível.
export async function pingDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export function createHealthRouter(
  ping: () => Promise<void> = pingDatabase,
): Router {
  const router = Router();

  // Liveness: o processo está de pé. Não toca em dependências externas.
  router.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/ready", async (req, res) => {
    try {
      await ping();
      res.status(200).json({ status: "ready", database: "up" });
    } catch (error) {
      logger.error("readiness falhou: banco indisponível", {
        requestId: req.id,
        errorType: error instanceof Error ? "Error" : typeof error,
      });
      res.status(503).json({ status: "unavailable", database: "down" });
    }
  });

  return router;
}

export const healthRouter = createHealthRouter();

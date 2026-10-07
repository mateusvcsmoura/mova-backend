import rateLimit, { Options } from "express-rate-limit";

import { env } from "../config/env.js";

const isTestEnv = (): boolean => process.env.NODE_ENV === "test";

interface CreateRateLimiterOptions extends Partial<Options> {
  // Desativa o limitador quando NODE_ENV === "test" (padrão: true).
  skipInTest?: boolean;
}

export function createRateLimiter(
  options: CreateRateLimiterOptions = {},
) {
  const { skipInTest = true, skip, ...rest } = options;

  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_WRITE_MAX,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      message: "Muitas requisições. Tente novamente mais tarde.",
    },
    // Preserva um skip customizado (se informado) e adiciona o skip de teste.
    skip: (req, res) => {
      if (skipInTest && isTestEnv()) return true;
      return skip ? skip(req, res) : false;
    },
    ...rest,
  });
}

export const authLimiter = createRateLimiter({
  limit: env.RATE_LIMIT_AUTH_MAX,
  message: {
    message:
      "Muitas tentativas de autenticação. Tente novamente mais tarde.",
  },
});

// Limitador para rotas de escrita (POST/PUT/PATCH/DELETE).
export const writeLimiter = createRateLimiter({
  limit: env.RATE_LIMIT_WRITE_MAX,
});

export const webhookLimiter = createRateLimiter({
  limit: env.RATE_LIMIT_WRITE_MAX,
});

const METODOS_ESCRITA = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const writeMethodsLimiter = (
  req: Parameters<typeof writeLimiter>[0],
  res: Parameters<typeof writeLimiter>[1],
  next: Parameters<typeof writeLimiter>[2],
) => {
  if (METODOS_ESCRITA.has(req.method)) {
    return writeLimiter(req, res, next);
  }
  return next();
};

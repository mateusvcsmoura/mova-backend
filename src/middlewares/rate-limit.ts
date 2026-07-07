import rateLimit, { Options } from "express-rate-limit";

import { env } from "../config/env.js";

// Rate limiting (hardening RNF05). Protege contra brute-force de autenticação
// e abuso de rotas de escrita. Todos os limites são configuráveis por env
// (ver config/env.ts) — configuração flexível, sem tocar no código.
//
// Em ambiente de teste o limitador é desativado por padrão (skipInTest), pois a
// suíte dispara muitas requisições pela mesma "origem". O teste dedicado do
// rate limit constrói um limitador com skipInTest = false para exercitar o 429.

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

// Limitador estrito para autenticação (login/register): defesa contra
// brute-force / credential stuffing.
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

// Aplica o writeLimiter apenas a métodos que mutam estado. Métodos de leitura
// (GET/HEAD/OPTIONS) passam direto.
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

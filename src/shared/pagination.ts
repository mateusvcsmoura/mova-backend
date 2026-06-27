import { z } from "zod";

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

// Valida/coage os parâmetros page e limit vindos da query string.
// Campos extras (filtros) são ignorados, então pode ser aplicado direto em req.query.
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Extrai page/limit de uma query string (lança ZodError -> 400 no error-handler).
export function getPaginationParams(query: unknown): PaginationParams {
  return paginationQuerySchema.parse(query);
}

// Converte page/limit nos parâmetros skip/take do Prisma.
export function toSkipTake({ page, limit }: PaginationParams): {
  skip: number;
  take: number;
} {
  return { skip: (page - 1) * limit, take: limit };
}

// Monta o resultado paginado a partir dos itens da página + total de registros.
export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  { page, limit }: PaginationParams,
): PaginatedResult<T> {
  return {
    data,
    total,
    page,
    limit,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

// Extrai apenas os metadados (sem os dados) — usado na resposta do controller:
// res.json({ result: data, pagination: meta }).
export function toPaginationMeta(result: {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}): PaginationMeta {
  return {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  };
}

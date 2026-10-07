import { z } from "zod";

export const createServicoOpcionalSchema = z.object({
  nome: z.string().min(2).max(255),
  descricao: z.string().min(2).max(255),
  valor: z.number().nonnegative(),
  ativo: z.boolean().optional(),
});

export const updateServicoOpcionalSchema = z.object({
  nome: z.string().min(2).max(255).optional(),
  descricao: z.string().min(2).max(255).optional(),
  valor: z.number().nonnegative().optional(),
  ativo: z.boolean().optional(),
});

// Query params da listagem (GET /api/servico). ?ativo=true|false (string).
export const servicoOpcionalQuerySchema = z.object({
  ativo: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

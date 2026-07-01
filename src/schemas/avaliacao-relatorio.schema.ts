import { z } from "zod";

// Query params do dashboard de avaliações (GET /api/avaliacao/relatorio).
// Todos os filtros são opcionais; sem filtros, considera toda a base do
// locador. granularidade e limiteComentarios têm default.
export const avaliacaoRelatorioQuerySchema = z
  .object({
    dataInicio: z.coerce.date().optional(),
    dataFim: z.coerce.date().optional(),
    idVeiculo: z.string().uuid().optional(),
    idModeloVeiculo: z.string().uuid().optional(),
    notaMin: z.coerce.number().min(1).max(5).optional(),
    notaMax: z.coerce.number().min(1).max(5).optional(),
    granularidade: z.enum(["dia", "mes", "ano"]).default("mes"),
    limiteComentarios: z.coerce.number().int().min(1).max(50).default(5),
  })
  .refine(
    (d) => !d.dataInicio || !d.dataFim || d.dataFim >= d.dataInicio,
    {
      message: "dataFim deve ser maior ou igual a dataInicio.",
      path: ["dataFim"],
    },
  )
  .refine(
    (d) =>
      d.notaMin === undefined ||
      d.notaMax === undefined ||
      d.notaMax >= d.notaMin,
    {
      message: "notaMax deve ser maior ou igual a notaMin.",
      path: ["notaMax"],
    },
  );

export type AvaliacaoRelatorioQuery = z.infer<
  typeof avaliacaoRelatorioQuerySchema
>;

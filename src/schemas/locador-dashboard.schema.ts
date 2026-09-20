import { StatusReserva } from "@prisma/client";
import { z } from "zod";
import { paginationQuerySchema } from "../shared/pagination.js";

// Filtros reais do relatório de reservas. Campos desconhecidos (inclusive
// idLocador) são descartados: ownership vem sempre do JWT.
export const relatorioReservasQuerySchema = paginationQuerySchema
  .extend({
    idVeiculo: z.string().uuid().optional(),
    status: z.nativeEnum(StatusReserva).optional(),
    dataInicio: z.coerce.date().optional(),
    dataFim: z.coerce.date().optional(),
  })
  .refine(
    (data) =>
      data.dataInicio === undefined ||
      data.dataFim === undefined ||
      data.dataInicio <= data.dataFim,
    {
      message: "dataInicio deve ser menor ou igual a dataFim.",
      path: ["dataFim"],
    },
  );

export type RelatorioReservasQuery = z.infer<
  typeof relatorioReservasQuerySchema
>;

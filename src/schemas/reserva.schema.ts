import { z } from "zod";
import { StatusPagamento, StatusReserva } from "@prisma/client";

export const reservaStatusSchema = z.nativeEnum(StatusReserva);
export const statusPagamentoSchema = z.nativeEnum(StatusPagamento);

export const createReservaSchema = z
  .object({
    idVeiculo: z.string().uuid(),
    idLocatario: z.string().uuid(),

    dataHoraInicio: z.coerce.date(),
    dataHoraFim: z.coerce.date(),

    // Decimal(10,2) no schema -> valor monetário positivo
    valorTotal: z.number().positive(),

    status: z.nativeEnum(StatusReserva).optional(),
    statusPagamento: z.nativeEnum(StatusPagamento).optional(),
  })
  .refine((data) => data.dataHoraFim > data.dataHoraInicio, {
    message: "A data/hora de término deve ser posterior à de início.",
    path: ["dataHoraFim"],
  });

export const updateReservaSchema = z
  .object({
    dataHoraInicio: z.coerce.date().optional(),
    dataHoraFim: z.coerce.date().optional(),
    valorTotal: z.number().positive().optional(),
    status: z.nativeEnum(StatusReserva).optional(),
    statusPagamento: z.nativeEnum(StatusPagamento).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Informe ao menos um campo para atualização",
  })
  .refine(
    (data) =>
      data.dataHoraInicio === undefined ||
      data.dataHoraFim === undefined ||
      data.dataHoraFim > data.dataHoraInicio,
    {
      message: "A data/hora de término deve ser posterior à de início.",
      path: ["dataHoraFim"],
    },
  );

// Query params da listagem (GET /api/reserva)
export const reservaQuerySchema = z.object({
  idVeiculo: z.string().uuid().optional(),
  idLocatario: z.string().uuid().optional(),
  status: z.nativeEnum(StatusReserva).optional(),
  statusPagamento: z.nativeEnum(StatusPagamento).optional(),
});

// Params de rota
export const reservaIdParamSchema = z.object({
  id: z.string().uuid(),
});

// Body do desbloqueio do veículo (POST /api/reserva/:id/desbloqueio)
export const desbloquearReservaSchema = z.object({
  codigo: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(v), {
      message: "Código deve estar no formato XXXX-XXXX",
    }),
});

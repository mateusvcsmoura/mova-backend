import { z } from "zod";
import { MetodoPagamento, StatusPagamento, StatusReserva } from "@prisma/client";

export const createReservaSchema = z
  .object({
    idVeiculo: z.string().uuid(),
    idLocatario: z.string().uuid(),

    // Deficiência informada no fluxo da reserva (veículos adaptados).
    deficienciaId: z.string().uuid().optional(),

    // Local de retirada (garagem atual do veículo) e local de devolução
    // (garagem do mesmo locador dono do veículo).
    idGaragemRetirada: z.string().uuid().optional(),
    idGaragemDevolucao: z.string().uuid().optional(),

    dataHoraInicio: z.coerce.date(),
    dataHoraFim: z.coerce.date(),

    // Decimal(10,2) no schema -> valor base positivo (o service soma os serviços)
    valorTotal: z.number().positive(),

    // Serviços opcionais selecionados (nenhum, um ou vários). Lista de UUIDs.
    servicosIds: z.array(z.string().uuid()).optional(),

    status: z.nativeEnum(StatusReserva).optional(),
    // statusPagamento NÃO é aceito do cliente: o resultado do pagamento só
    // muda pelo webhook assinado do gateway (POST /api/webhooks/pagamento/*).
    // metodoPagamento é uma escolha do cliente (meio pretendido), não o
    // resultado, então permanece aceito.
    metodoPagamento: z.nativeEnum(MetodoPagamento).optional(),
  })
  .refine((data) => data.dataHoraFim > data.dataHoraInicio, {
    message: "A data/hora de término deve ser posterior à de início.",
    path: ["dataHoraFim"],
  });

export const updateReservaSchema = z
  .object({
    idGaragemDevolucao: z.string().uuid().optional(),
    dataHoraInicio: z.coerce.date().optional(),
    dataHoraFim: z.coerce.date().optional(),
    valorTotal: z.number().positive().optional(),
    status: z.nativeEnum(StatusReserva).optional(),
    // statusPagamento removido do fluxo do cliente (só muda via webhook do
    // gateway). Ver createReservaSchema.
    metodoPagamento: z.nativeEnum(MetodoPagamento).optional(),
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

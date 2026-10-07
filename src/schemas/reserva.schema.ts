import { z } from "zod";
import { MetodoPagamento, StatusPagamento, StatusReserva } from "@prisma/client";

const DURACAO_MINIMA_MS = 60 * 60 * 1000;
const DURACAO_MAXIMA_MS = 30 * 24 * 60 * 60 * 1000;
const dentroDaDuracaoPermitida = (inicio: Date, fim: Date): boolean => {
  const duracao = fim.getTime() - inicio.getTime();
  return duracao >= DURACAO_MINIMA_MS && duracao <= DURACAO_MAXIMA_MS;
};
const MENSAGEM_DURACAO =
  "A reserva deve ter entre 1 hora e 30 dias de duração.";

export const createReservaSchema = z
  .object({
    idVeiculo: z.string().uuid(),
    idLocatario: z.string().uuid(),

    // Deficiência informada no fluxo da reserva (veículos adaptados).
    deficienciaId: z.string().uuid().optional(),

    idGaragemRetirada: z.string().uuid().optional(),
    idGaragemDevolucao: z.string().uuid().optional(),

    dataHoraInicio: z.coerce.date(),
    dataHoraFim: z.coerce.date(),

    // Serviços opcionais selecionados (nenhum, um ou vários). Lista de UUIDs.
    servicosIds: z.array(z.string().uuid()).optional(),

    metodoPagamento: z.nativeEnum(MetodoPagamento).optional(),
  })
  .refine((data) => data.dataHoraFim > data.dataHoraInicio, {
    message: "A data/hora de término deve ser posterior à de início.",
    path: ["dataHoraFim"],
  })
  .refine(
    (data) => dentroDaDuracaoPermitida(data.dataHoraInicio, data.dataHoraFim),
    { message: MENSAGEM_DURACAO, path: ["dataHoraFim"] },
  );

export const quoteReservaSchema = z
  .object({
    idVeiculo: z.string().uuid(),
    idGaragemRetirada: z.string().uuid().optional(),
    idGaragemDevolucao: z.string().uuid().optional(),
    dataHoraInicio: z.coerce.date(),
    dataHoraFim: z.coerce.date(),
    servicosIds: z.array(z.string().uuid()).optional(),
  })
  .strict()
  .refine((data) => data.dataHoraFim > data.dataHoraInicio, {
    message: "A data/hora de término deve ser posterior à de início.",
    path: ["dataHoraFim"],
  })
  .refine(
    (data) => dentroDaDuracaoPermitida(data.dataHoraInicio, data.dataHoraFim),
    { message: MENSAGEM_DURACAO, path: ["dataHoraFim"] },
  );

export const updateReservaSchema = z
  .object({
    idGaragemDevolucao: z.string().uuid().optional(),
    dataHoraInicio: z.coerce.date().optional(),
    dataHoraFim: z.coerce.date().optional(),
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
  )
  .refine(
    (data) =>
      data.dataHoraInicio === undefined ||
      data.dataHoraFim === undefined ||
      dentroDaDuracaoPermitida(data.dataHoraInicio, data.dataHoraFim),
    { message: MENSAGEM_DURACAO, path: ["dataHoraFim"] },
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

const coordenadaFields = {
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
};
const ambasOuNenhumaCoordenada = (data: {
  latitude?: number;
  longitude?: number;
}) => (data.latitude === undefined) === (data.longitude === undefined);
const MENSAGEM_COORDENADA =
  "Informe latitude e longitude juntas (ou nenhuma).";

// Body do desbloqueio do veículo (POST /api/reserva/:id/desbloqueio)
export const desbloquearReservaSchema = z
  .object({
    codigo: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(v), {
        message: "Código deve estar no formato XXXX-XXXX",
      }),
    ...coordenadaFields,
  })
  .refine(ambasOuNenhumaCoordenada, {
    message: MENSAGEM_COORDENADA,
    path: ["longitude"],
  });

export const desbloquearQrSchema = z
  .object({
    qr: z.string().min(1),
    ...coordenadaFields,
  })
  .refine(ambasOuNenhumaCoordenada, {
    message: MENSAGEM_COORDENADA,
    path: ["longitude"],
  });

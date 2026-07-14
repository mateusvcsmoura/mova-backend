import { z } from "zod";
import { MetodoPagamento, StatusPagamento, StatusReserva } from "@prisma/client";

// RN05: duração da reserva. Mínimo 1 hora, máximo 30 dias (bordas inclusivas).
// Espelha a checagem-fonte em ReservaService.assertPeriodoValido.
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
    // RN04: status e valorTotal NÃO são mais aceitos via PUT. Mutação livre de
    // status/valor era vulnerabilidade transversal (cancelar de graça, reescrever
    // preço). Cancelamento agora é ação de domínio: POST /:id/cancelar.
    // statusPagamento continua fora do cliente (só muda via webhook do gateway).
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

// Coordenada do dispositivo no momento do desbloqueio (RN03 — geofence).
// Latitude/longitude são opcionais, mas ou ambas ou nenhuma.
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

// Body do desbloqueio via QR Code (POST /api/reserva/:id/desbloqueio/qr).
// O QR carrega um token assinado que resolve para o mesmo código textual.
export const desbloquearQrSchema = z
  .object({
    qr: z.string().min(1),
    ...coordenadaFields,
  })
  .refine(ambasOuNenhumaCoordenada, {
    message: MENSAGEM_COORDENADA,
    path: ["longitude"],
  });

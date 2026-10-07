export const LOCALES = ["pt", "en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_PADRAO: Locale = "pt";

export function resolveLocale(acceptLanguage?: string): Locale {
  if (!acceptLanguage) return LOCALE_PADRAO;
  for (const parte of acceptLanguage.split(",")) {
    const base = parte.trim().split(";")[0].trim().slice(0, 2).toLowerCase();
    if ((LOCALES as readonly string[]).includes(base)) {
      return base as Locale;
    }
  }
  return LOCALE_PADRAO;
}

// Códigos de erro estáveis (contrato com o cliente — não mudam entre idiomas).
export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_TOKEN: "INVALID_TOKEN",
  SESSION_REVOKED: "SESSION_REVOKED",
  ACCOUNT_HAS_HISTORY: "ACCOUNT_HAS_HISTORY",
  // Task 10 (D10-06): mudança de status recusada por reserva paga futura.
  VEICULO_COM_RESERVA_FUTURA_CONFIRMADA: "VEICULO_COM_RESERVA_FUTURA_CONFIRMADA",
  // Task 10.1: pagamento recusado porque veículo/garagem ficou indisponível.
  VEICULO_INDISPONIVEL_PARA_CONFIRMAR_RESERVA: "VEICULO_INDISPONIVEL_PARA_CONFIRMAR_RESERVA",
  GARAGEM_INDISPONIVEL_PARA_CONFIRMAR_RESERVA: "GARAGEM_INDISPONIVEL_PARA_CONFIRMAR_RESERVA",
  // Task 10.1: garagem ainda necessária a reservas confirmadas.
  GARAGEM_COM_RESERVA_FUTURA_CONFIRMADA: "GARAGEM_COM_RESERVA_FUTURA_CONFIRMADA",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const CATALOGO: Record<Locale, Partial<Record<string, string>>> = {
  pt: {
    VALIDATION_ERROR: "Dados inválidos.",
    INTERNAL_ERROR: "Erro interno do servidor.",
    UNAUTHENTICATED: "Não autenticado.",
    FORBIDDEN: "Acesso negado.",
    INVALID_TOKEN: "Token inválido ou expirado.",
  },
  en: {
    VALIDATION_ERROR: "Invalid data.",
    INTERNAL_ERROR: "Internal server error.",
    UNAUTHENTICATED: "Not authenticated.",
    FORBIDDEN: "Access denied.",
    INVALID_TOKEN: "Invalid or expired token.",
    VEICULO_COM_RESERVA_FUTURA_CONFIRMADA:
      "This vehicle has a confirmed upcoming or ongoing booking. Resolve those bookings before putting it under maintenance or deactivating it.",
    VEICULO_INDISPONIVEL_PARA_CONFIRMAR_RESERVA:
      "The vehicle for this booking is currently unavailable. The payment was not confirmed and nothing was charged.",
    GARAGEM_INDISPONIVEL_PARA_CONFIRMAR_RESERVA:
      "The pickup or return location for this booking is currently unavailable. The payment was not confirmed and nothing was charged.",
    GARAGEM_COM_RESERVA_FUTURA_CONFIRMADA:
      "This garage has confirmed bookings that still depend on it. Resolve those bookings before putting it under maintenance or deactivating it.",
  },
  es: {
    VALIDATION_ERROR: "Datos inválidos.",
    INTERNAL_ERROR: "Error interno del servidor.",
    UNAUTHENTICATED: "No autenticado.",
    FORBIDDEN: "Acceso denegado.",
    INVALID_TOKEN: "Token inválido o expirado.",
    VEICULO_COM_RESERVA_FUTURA_CONFIRMADA:
      "El vehículo tiene una reserva confirmada futura o en curso. Resuelva esas reservas antes de ponerlo en mantenimiento o desactivarlo.",
    VEICULO_INDISPONIVEL_PARA_CONFIRMAR_RESERVA:
      "El vehículo de esta reserva no está disponible en este momento. El pago no se confirmó y no se cobró nada.",
    GARAGEM_INDISPONIVEL_PARA_CONFIRMAR_RESERVA:
      "El lugar de retiro o de devolución de esta reserva no está disponible en este momento. El pago no se confirmó y no se cobró nada.",
    GARAGEM_COM_RESERVA_FUTURA_CONFIRMADA:
      "Este garaje tiene reservas confirmadas que todavía dependen de él. Resuelva esas reservas antes de ponerlo en mantenimiento o desactivarlo.",
  },
};

export function traduzirErro(
  code: string | undefined,
  locale: Locale,
): string | undefined {
  if (!code) return undefined;
  return CATALOGO[locale]?.[code];
}

// Internacionalização (i18n). Idiomas suportados e catálogo de mensagens de
// erro por CÓDIGO estável. Regras de negócio NÃO são traduzidas — só o texto
// voltado ao usuário. Compatibilidade: o padrão é "pt" e, em "pt", o
// error-handler mantém a mensagem original do erro (não consulta o catálogo).

export const LOCALES = ["pt", "en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_PADRAO: Locale = "pt";

// Resolve o idioma a partir do header Accept-Language (ex.: "en-US,en;q=0.9").
// Cai no padrão quando ausente/desconhecido. Ignora q-values (basta o 1º match).
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
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// Catálogo por idioma. Só precisa conter os códigos efetivamente emitidos; o
// que faltar cai na mensagem original do erro (fallback no error-handler).
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
  },
  es: {
    VALIDATION_ERROR: "Datos inválidos.",
    INTERNAL_ERROR: "Error interno del servidor.",
    UNAUTHENTICATED: "No autenticado.",
    FORBIDDEN: "Acceso denegado.",
    INVALID_TOKEN: "Token inválido o expirado.",
  },
};

// Traduz um código de erro para o idioma. Retorna undefined quando não há
// entrada — o chamador então usa a mensagem original (compatibilidade).
export function traduzirErro(
  code: string | undefined,
  locale: Locale,
): string | undefined {
  if (!code) return undefined;
  return CATALOGO[locale]?.[code];
}

# Notas de implementação — src/i18n

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `src/i18n/index.ts`

**`export const LOCALES = ["pt", "en", "es"] as const;`**

Internacionalização (i18n). Idiomas suportados e catálogo de mensagens de
erro por CÓDIGO estável. Regras de negócio NÃO são traduzidas — só o texto
voltado ao usuário. Compatibilidade: o padrão é "pt" e, em "pt", o
error-handler mantém a mensagem original do erro (não consulta o catálogo).

**`export function resolveLocale(acceptLanguage?: string): Locale {`**

Resolve o idioma a partir do header Accept-Language (ex.: "en-US,en;q=0.9").
Cai no padrão quando ausente/desconhecido. Ignora q-values (basta o 1º match).

**`const CATALOGO: Record<Locale, Partial<Record<string, string>>> = {`**

Catálogo por idioma. Só precisa conter os códigos efetivamente emitidos; o
que faltar cai na mensagem original do erro (fallback no error-handler).

**`export function traduzirErro(`**

Traduz um código de erro para o idioma. Retorna undefined quando não há
entrada — o chamador então usa a mensagem original (compatibilidade).

## `src/i18n/mensagens.ts`

**`import type { Locale } from "./index.js";`**

Catálogo de mensagens de negócio (HttpError sem code) por texto pt-BR exato.
Usado pelo error-handler só quando locale !== "pt"; em pt a mensagem original
sai intacta. Mensagem ausente aqui cai no texto original (fallback seguro).
test/i18n/mensagens-catalogo.test.ts varre src/ e falha se um literal novo de
`new HttpError(` não tiver entrada.

# Notas de implementação — src/types

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `src/@types/express/index.d.ts`

**`id?: string;`**

Correlação de requisição (observabilidade). Definido pelo middleware
observability a partir do header X-Request-Id ou de um UUID gerado.

**`locale?: import("../../i18n/index.js").Locale;`**

Idioma resolvido do Accept-Language (i18n). Definido pelo middleware
locale; "pt" | "en" | "es", padrão "pt".

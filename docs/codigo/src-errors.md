# Notas de implementação — src/errors

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `src/errors/HttpError.ts`

**`code?: string;`**

Código de erro estável (i18n). Opcional: quando presente, o error-handler
pode traduzir a mensagem por idioma. A mensagem (em pt) segue no `message`.

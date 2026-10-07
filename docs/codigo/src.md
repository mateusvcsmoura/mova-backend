# Notas de implementação — src (raiz)

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `src/app.ts`

**`const DEV_ORIGINS = [`**

Origens permitidas: da env (CORS_ORIGINS, separadas por vírgula) ou, na
ausência, um whitelist de desenvolvimento. NUNCA "\*".

**`return callback(null, allowedOrigins.includes(origin));`**

Origem na whitelist: libera; caso contrário, não envia os headers CORS
(o navegador bloqueia). Não lança erro para não virar 500.

**`app.use(observability);`**

Observabilidade primeiro: garante request id + timing para toda requisição,
inclusive as bloqueadas por middlewares seguintes.

**`app.use(localeMiddleware);`**

i18n: resolve o idioma (Accept-Language) cedo, para error-handler e demais
fluxos disporem de req.locale.

**`app.use(`**

Helmet: headers de segurança. crossOriginResourcePolicy relaxado para
"cross-origin" — a API é consumida por clientes de outra origem (mobile/web).

**`app.use("/api/webhooks", webhookLimiter, webhookRouter);`**

Webhooks de pagamento ANTES do express.json: precisam do corpo cru (bytes
exatos) para validar a assinatura HMAC. O próprio router aplica express.raw.

**`app.use("/api/", healthRouter);`**

Health/readiness antes do apiMetadata: respostas enxutas (status/uptime/...)
sem o envelope de metadados, no formato esperado por orquestradores.

**`app.use(writeMethodsLimiter);`**

Rate limiting das rotas de escrita (POST/PUT/PATCH/DELETE). Autenticação tem
limitador próprio, mais estrito, aplicado na rota de conta.

## `src/server.ts`

**`if (`**

Monitoramento da frota (alertas de inatividade/baixa avaliação): opt-in
via env, nunca em ambiente de teste. Intervalo configurável por
MONITORAMENTO_INTERVALO_MS (padrão 1h).

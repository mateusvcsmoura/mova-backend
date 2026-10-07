# Notas de implementação — src/config

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `src/config/env.ts`

**`CORS_ORIGINS: z.string().optional(),`**

Segurança HTTP (hardening RNF05).
Origens permitidas pelo CORS, separadas por vírgula (ex.:
"https://app.mova.com,https://admin.mova.com"). Quando ausente, cai no
whitelist de desenvolvimento definido em app.ts. NUNCA usar "\*".

**`RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),`**

Janela e limites do rate limiting. Flexíveis por ambiente sem tocar no
código; o padrão é janela de 15 min.

**`TIMEZONE_EXIBICAO: z.string().min(1).default("America/Sao_Paulo"),`**

Fuso usado para RENDERIZAR data/hora para humanos (e-mails, relatórios).
NÃO afeta armazenamento nem comparação: instantes trafegam e são gravados
em UTC. Sem isto, a formatação usaria o fuso do servidor — num host em UTC (ex.: CI)
um horário de 10:00 em São Paulo sairia como 13:00 no e-mail.

**`DESBLOQUEIO_RAIO_METROS: z.coerce.number().positive().default(100),`**

RN03: raio (em metros) do geofence de desbloqueio. O desbloqueio precisa
ocorrer dentro desse raio da última localização conhecida do veículo.
Quando não há localização de referência, o geofence é ignorado (permite).

**`SMTP_HOST: z.string().min(1).optional(),`**

Configuração SMTP (Nodemailer). Opcional: quando ausente, o envio de
e-mails fica desabilitado (útil em testes/dev) sem quebrar o boot.

**`PAGAMENTO_SANDBOX_PROVIDER: z`**

Sandbox de pagamento: qual gateway o simulador usa para assinar o webhook,
e quanto ele demora para entregá-lo (0 = síncrono, usado nos testes).

**`PAGAMENTO_SIMULADOR_DELAY_MS: z.coerce`**

0 = o webhook é entregue na mesma requisição (determinístico, usado nos
testes). Em execução normal há atraso, para o cliente observar PROCESSANDO.

**`MERCADOPAGO_WEBHOOK_SECRET: z.string().min(1).optional(),`**

Segredos de assinatura dos webhooks de pagamento. Um por gateway. Quando
ausente, o gateway correspondente rejeita todo webhook (não há como validar
a assinatura). NUNCA versionar valores reais — só o .env.example documenta.

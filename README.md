# MOVA - Backend

API REST em Node.js + TypeScript da plataforma MOVA, de locação de veículos por demanda com foco em acessibilidade. É o produto final do TCC (FATEC) junto com o [`mova-frontend`](https://github.com/GabrielaCalazans/mova-frontend).

O catálogo tem veículos econômicos, espaçosos, executivos, elétricos e adaptados (PCD). Há três públicos: **locatário**, que reserva e dirige; **locador**, empresa dona da frota e das garagens; e **admin**. Tudo roda localmente: PostgreSQL e MinIO em Docker, pagamentos em sandbox simulado e e-mail por SMTP opcional.

O que a API cobre:
- **Contas e acesso:** contas com RBAC, LGPD, trilha de auditoria e bloqueio de locatários.
- **Frota:** veículos com imagens, garagens, serviços opcionais e dashboard do locador.
- **Reservas:**
  - pagamento e desbloqueio por código ou QR;
  - condutores adicionais, cobranças avulsas e compartilhamento de viagem;
  - avaliações, favoritos e lista de interesse.
- **Operação:** rastreamento e monitoramento simulados, além de notificações.

## Stack

- Node.js + TypeScript (ESM), Express 5
- PostgreSQL 16 + Prisma ORM 7 (`@prisma/adapter-pg`)
- Zod (validação), JWT + bcrypt (autenticação)
- Helmet, CORS e `express-rate-limit` (segurança)
- MinIO local (imagens de veículos) via `@aws-sdk/client-s3`. É só o cliente S3; não há conta AWS.
- Nodemailer (SMTP)
- Vitest + Supertest (testes), Allure (relatórios no CI)

## Arquitetura

Camadas com injeção de dependências manual. O composition root fica em `src/routes/container.ts`, e cada camada depende de interfaces, nunca de implementações concretas:

```
Router -> Middlewares -> Controller -> Service -> IRepository -> Prisma -> PostgreSQL
                            |             |
                       schemas Zod    infra (e-mail, mídia, pagamento) e notifiers
```

**Camadas da requisição**
- **Routes** (`src/routes/`): um diretório por domínio. Aplicam `authMiddleware` (JWT) e `authorize(<Cargo>)` (RBAC).
- **Controllers** (`src/controllers/`): validam a requisição com Zod e delegam ao service. Não contêm regra de negócio.
- **Services** (`src/services/`): concentram toda a regra de negócio. Os payloads ficam em `services/contracts/`.
- **Repositories** (`src/repositories/`):
  - interfaces `I*Repository` na raiz;
  - DTOs em `contracts/`;
  - implementações Prisma em `prisma/`;
  - conversões em `mappers/`.

**Adaptadores externos** (`src/infra/`), todos atrás de interfaces:
- `email/`: `IMailProvider` + Nodemailer.
- `media/`: `StorageProvider` S3 (MinIO), validação de imagem e limpeza de órfãos.
- `payment/`: gateway sandbox que simula Mercado Pago, Stripe e Asaas.

**Apoio**
- **Middlewares** (`src/middlewares/`): `observability`, `locale`, `rate-limit`, `auth-middleware`, `authorization-middleware`, `api-version` e `error-handler`.
- **Templates** (`src/templates/`): funções puras que geram `{ subject, html, text }` para os e-mails.
- **i18n** (`src/i18n/`): mensagens da API em pt-BR, en e es.
- **Shared** (`src/shared/`): paginação, logger, retry, advisory lock, documentos (CPF/CNPJ/CNH) e prazo de pagamento.
- **Errors** (`src/errors/`): `HttpError`, propagado via `next(error)` e traduzido pelo `error-handler`.

### Pipeline do Express (`src/app.ts`)

```
observability -> locale -> helmet -> cors
  -> /api/webhooks          (corpo cru + rate limit próprio; antes do JSON para o HMAC ver os bytes exatos)
  -> express.json(BODY_LIMIT)
  -> /api/health, /api/ready
  -> apiMetadata -> rate limit de escrita -> routers -> 404 NOT_FOUND -> error-handler
```

### Convenções da API

**Formato das respostas**
- Toda resposta (exceto health, ready e webhooks) vem no envelope `{ api_version, timestamp, docs, success, ...corpo }`.
- Listagens são paginadas (`?page=&limit=`) e respondem `{ result, pagination }`. Uma lista vazia responde 200, não 404.

**Erros**
- O formato é `{ code, message, requestId }`, e o `code` padrão de regra de negócio é `BUSINESS_ERROR`.
- Zod vira 400 `VALIDATION_ERROR`, com `errors: [{ path, message }]`.
- Um erro não tratado vira 500 `INTERNAL_ERROR`. O erro original nunca é logado, porque pode conter segredos.
- Toda resposta traz o header `X-Request-Id`, e os logs são JSON estruturado por evento.

**Idioma**
- Pelo `Accept-Language`, as mensagens saem em pt (padrão), en ou es. A tradução procura primeiro pelo `code` e depois pelo texto exato em `src/i18n/mensagens.ts`.
- Dados como marca, status e categoria nunca são traduzidos.
- `test/i18n/mensagens-catalogo.test.ts` falha se um `new HttpError("...")` novo ficar sem tradução.

**Contratos de entrada**
- A posse do recurso vem sempre do JWT, nunca do body ou da query. Isso vale para favoritos, interesses, dashboard, relatórios e `/veiculo/meus`, e filtros como `idLocador` vindos do cliente são descartados.
- Em contratos sensíveis (atualização da própria conta, cadastro de veículo), campos extras são recusados em vez de ignorados.

## Estrutura do projeto

```
src/
  app.ts               # montagem do Express, middlewares e routers
  server.ts            # boot (porta, simulador de GPS e monitoramento opcionais)
  config/              # leitura/validação do ambiente (Zod) e trava do ambiente de teste
  database/prisma.ts   # cliente Prisma (usa *_TEST quando NODE_ENV=test)
  routes/              # um diretório por domínio + container.ts (DI)
  controllers/
  services/
  repositories/
  schemas/             # validações Zod por domínio
  infra/               # email/, media/, payment/
  middlewares/
  templates/
  i18n/
  shared/
  errors/
  @types/              # extensões do Request do Express (user, id, locale)
prisma/
  schema.prisma        # modelos, enums, índices e constraints
  migrations/          # SQL versionado (inclui o gatilho da auditoria)
  scripts/             # seed, seed-demo, seed-demo-frota, reset, media-init, media-cleanup
  assets/veiculos/     # fotos da frota de demonstração (créditos no fim deste README)
  dbml/                # schema.dbml (gerado pelo prisma generate) e modelo-tcc.dbml (diagrama ER do TCC)
docker/
  docker-compose.yml   # PostgreSQL e MinIO (perfil "media")
  postgres-init/       # cria o banco mova_test na primeira inicialização
scripts/               # PowerShell: start, check, backup, restore, verify; bench-mova.mjs
test/                  # suítes por domínio (Vitest + Supertest)
```

## Domínio (Prisma)

**Contas e perfis**
- **Conta**, com RBAC pelo enum `Cargo`.
  - Perfis 1:1: **Locatario** (CPF, CNH e deficiência opcional) e **Locador** (empresa e CNPJ). O id do perfil é o id da conta.
- **Deficiencia** (catálogo) e **RecuperacaoSenha**.

**Frota**
- **ModeloVeiculo**: único por locador, marca, modelo e ano. Guarda a `valorDiaria` e a `CategoriaVeiculo`.
- **Veiculo**: placa, `StatusVeiculo` e garagem atual, com **VeiculoImagem** e **VeiculoStatusHistorico** (somente inserção).
- **Garagem**: capacidade, acessibilidade e `StatusGaragem`. É o local de retirada e de devolução.

**Reservas e pagamento**
- **Reserva**: período, valores, `StatusReserva` + `StatusPagamento` e código de desbloqueio. Associados a ela:
  - **ServicoOpcional**/**ReservaServico** (guarda um snapshot do preço);
  - **CondutorAdicional**;
  - **CobrancaReserva** (`PAGAMENTO_RESERVA`, `CANCELAMENTO`, `ATRASO_DEVOLUCAO`);
  - **CompartilhamentoReserva**;
  - **EventoFinanceiroSandbox** (somente inserção, com chave de idempotência).

**Relacionamento com o cliente**
- **Avaliacao** (1:1 com reserva realizada; nota de 1 a 5 com uma casa decimal).
- **Favorito** e **InteresseVeiculo** + **NotificacaoInteresse**.
- **NotificacaoReserva** e **PreferenciaNotificacao**.

**Operação e controle**
- **BloqueioLocatario**: motivos, expiração e revogação.
- **Localizacao** (histórico de posições) e **AlertaVeiculo** (monitoramento).
- **AcessoDadoPessoal** (LGPD) e **RegistroAuditoria** (trilha somente leitura).

### Ciclo de vida da reserva

```
AGUARDANDO_PAGAMENTO --webhook SUCESSO--> CONFIRMADA --desbloqueio--> EM_ANDAMENTO --devolução--> REALIZADA
        |                                     |
        +-- expiração (15 min) ou cancelamento +--> CANCELADA
```

- **Pagamento:**
  - `StatusPagamento` (`AGUARDANDO_PAGAMENTO`, `PROCESSANDO`, `SUCESSO`, `FALHA`) só muda pelo webhook assinado;
  - o código de desbloqueio é gerado na mesma escrita que confirma a reserva.
- **Cliente:**
  - `status`, `statusPagamento` e `valorTotal` nunca vêm do cliente;
  - o `PUT` aceita só campos editáveis, e só em reserva não cancelada.
- **Expiração preguiçosa:**
  - não há job nem fila: `expirarReservasVencidas` roda antes das leituras e operações;
  - cada reserva vencida (15 min desde `criadaEm`, sem pagamento confirmado) vira `CANCELADA` com `expiradaEm`, numa transação curta sob o lock da reserva, sem multa;
  - um webhook que chega depois do prazo encontra a reserva expirada e não a confirma.

## Regras de negócio

| Regra | Como é aplicada |
| --- | --- |
| **RN01** (veículo adaptado) | Um veículo é PCD se `adaptado=true` **ou** se a categoria for PCD; um único marcador basta. Reservá-lo exige locatário com deficiência declarada. Se o perfil ainda não tiver, `deficienciaId` pode ser informado no fluxo e é gravado na mesma transação da reserva. |
| **RN02** (condutores) | Até 3 condutores adicionais, com CNH única na reserva. Só podem ser alterados antes do início, com `SELECT … FOR UPDATE` na reserva. |
| **RN03** (desbloqueio) | Verifica nesta ordem: código, janela de validade e uso único, geofence. O geofence usa Haversine até a última `Localizacao` do veículo, com raio de `DESBLOQUEIO_RAIO_METROS` (100 m). Fora do raio dá 403; sem coordenada do dispositivo, 400; sem localização de referência do veículo, 409. |
| **RN04** (cancelamento) | Grátis até 2 h antes do início; depois, multa de 20% do `valorTotal`. A multa só vale quando o próprio locatário cancela; locador e admin nunca multam. A cobrança é sempre gravada, mesmo com valor zero. Em reserva paga, a multa é retida do estorno, o que evita cobrança dupla. |
| **RN05** (período) | A duração vai de 1 h a 30 dias, com as bordas inclusivas, checada no Zod e no service. |
| **RN06** (atraso) | Só em reserva `EM_ANDAMENTO` com o código já usado. A multa é proporcional, `valorDiaria × atraso/24h × 1,10`, calculada em centavos, e gera uma cobrança `ATRASO_DEVOLUCAO`. |
| **RN07** (bloqueio) | Criar reserva e confirmar pagamento dão 403 se o locatário tiver um bloqueio ativo ou uma cobrança de cancelamento ou atraso ainda em aberto. |
| **RN08** (soft delete) | DELETE de garagem marca `INATIVA`, e de veículo marca `INATIVO`. Repetir o DELETE não faz nada. Um veículo inativo é tratado como inexistente pelo público. |
| **RN09** (auditoria) | As ações de locador e admin sobre veículos e reservas geram `RegistroAuditoria`, na mesma transação, com o ator vindo do JWT. |

**Preço**
- O preço é `valorDiaria` do modelo × número de diárias, em que fração de dia conta como diária cheia, mais os serviços opcionais.
- `POST /reserva/precificacao` calcula sem gravar. A criação recalcula, para impedir preço obsoleto ou manipulado.

**Garagens e reservabilidade**
- A retirada é a garagem atual do veículo. A devolução é qualquer garagem `ATIVA` do mesmo locador.
- Para ser reservável, o veículo precisa estar `DISPONIVEL` numa garagem `ATIVA`, e o catálogo público só mostra esses veículos.

**Código de desbloqueio**
- Formato `XXXX-XXXX`, com alfabeto sem 0, O, 1, I e L.
- Vale a partir do início da reserva e só pode ser usado uma vez.
- O QR é um JWT com `{ idReserva, codigo, exp }` e passa pelo mesmo fluxo do código textual.

**Proteção de compromissos**
- Veículo ou garagem com reserva paga futura (ou em andamento) não vai para manutenção nem é inativado. A recusa é 409 com `VEICULO_COM_RESERVA_FUTURA_CONFIRMADA` ou `GARAGEM_COM_RESERVA_FUTURA_CONFIRMADA`, e nada é cancelado automaticamente.

**Rastreamento**
- O locatário só rastreia a própria reserva `CONFIRMADA` ou `EM_ANDAMENTO`, dentro do período dela.
- O locador vê só os próprios veículos.

## Concorrência e consistência

**Double-booking**
- Não há constraint de exclusão no banco. A criação da reserva pega `pg_advisory_xact_lock(hashtextextended(idVeiculo, 0))`.
- Dentro do lock, a sobreposição é checada de novo, ignorando reservas canceladas e vencidas.
- `test/reserva/reserva-concorrente.test.ts` prova que, de duas requisições simultâneas, uma recebe 201 e a outra 409.

**Ordem global de locks**
- A ordem é: reserva (advisory), veículo (advisory), garagens (`FOR UPDATE`/`FOR SHARE`, ordenadas por id) e, por fim, as linhas de reserva. A ordem invertida causava deadlock (`40P01`).
- A exclusão de conta e a criação de reserva compartilham o lock `conta:<id>`.

**Confirmação de pagamento**
- O pagamento só é confirmado com veículo e garagens operacionais, conferidos sob os locks.
- Se o problema aparece já no webhook, a tentativa vira `FALHA` e o valor é estornado.

**Jobs periódicos**
- Monitoramento e simulador de GPS usam `pg_try_advisory_xact_lock` não bloqueante. Se outra instância já está rodando, o tick é pulado.

**Transações no PrismaPg**
- Cada transação roda numa única conexão, então as consultas dentro de `$transaction` são sequenciais, nunca em paralelo.

## Pagamentos (sandbox)

Não há gateway real. `PAGAMENTO_SANDBOX_PROVIDER` escolhe qual gateway é simulado: `mercadopago`, `stripe` ou `asaas`.

O cliente envia só o método e os dados de teste. Nada do cartão é gravado, e o backend decide o desfecho:

| Entrada | Desfecho |
| --- | --- |
| Cartão terminado em `0000` | `FALHA` |
| Cartão terminado em `0001` | `PROCESSANDO` sem webhook (simula análise antifraude) |
| Outro cartão, Pix ou carteira digital | `SUCESSO` |

**Fluxo**
- `POST /reserva/:id/pagamento` responde 202, cria a cobrança `PAGAMENTO_RESERVA` e muda o status para `PROCESSANDO` na mesma transação.
- O simulador assina o evento com HMAC-SHA256 do corpo cru e o entrega, depois de `PAGAMENTO_SIMULADOR_DELAY_MS` (1,5 s), ao mesmo `PagamentoWebhookService` usado por um gateway real. Não existe atalho.

**Webhook** (`/api/webhooks/pagamento/:provider`)
- **Autenticação:** não usa JWT, a confiança vem da assinatura (`x-mp-signature`, `stripe-signature` ou `asaas-signature`), comparada com `timingSafeEqual`. Assinatura inválida ou segredo ausente dá 401, e provider desconhecido dá 404.
- **Recusa:** mesmo quando a confirmação é recusada (RN07, veículo indisponível), a resposta é 200 `{ received: true }`, para o gateway não reenviar sem fim. A tentativa vira `FALHA` e o valor é estornado.
- **Idempotência:**
  - a chave é `provider:providerEventId`, protegida por advisory lock;
  - a aprovação é terminal, e só a entrega que gerou o código envia o e-mail;
  - repetir um cancelamento reconcilia o estorno.

**Integração real**

Para ligar um gateway real, basta mapear o formato dele em `parseEvento`.

## Segurança

**Autenticação e contas**
- O JWT tem o payload `{ id, cargo }` e é validado em toda requisição contra a conta no banco. Conta inexistente ou anonimizada dá 401, o que revoga os tokens já emitidos.
- O registro público só cria `LOCATARIO` ou `LOCADOR`, nunca `ADMIN`. Conta e perfil são criados numa única transação.
- Senhas:
  - mínimo de 8 caracteres, com minúscula, maiúscula, número e símbolo;
  - hash com bcrypt.
- Recuperação de senha:
  - token aleatório de 32 bytes, do qual só o SHA-256 é gravado;
  - TTL de `PASSWORD_RESET_TTL_MINUTES` (30) e uso único;
  - a resposta é a mesma exista ou não a conta, o que impede enumeração de e-mails.

**Proteção HTTP**
- Rate limit por IP, numa janela de 15 min:
  - autenticação: 10 requisições (`RATE_LIMIT_AUTH_MAX`);
  - escrita: 100 (`RATE_LIMIT_WRITE_MAX`);
  - webhooks têm um limite próprio.
- O `start-mova.ps1` sobe o limite de autenticação para 200, porque a demo troca muito de conta na mesma máquina.
- CORS:
  - usa a whitelist `CORS_ORIGINS`;
  - em desenvolvimento libera `localhost:3000`, `localhost:5173`, `127.0.0.1:4173` e `127.0.0.1:5173`;
  - origem fora da lista não recebe os headers.
- Em `NODE_ENV=production`, o boot falha se `CORS_ORIGINS` estiver vazio ou tiver `*`, ou se `JWT_SECRET` tiver menos de 32 caracteres.

**Dados pessoais e consistência**
- CPF, CNPJ e CNH são validados pelo dígito verificador. O RG não é único, porque o número se repete entre estados.
- Minimização de dados:
  - o locador vê nome e CNH dos condutores adicionais, mas não o CPF;
  - o código de desbloqueio nunca aparece nas projeções de gestão.
- A exclusão de conta só acontece sem histórico de reservas. Com histórico, o caminho é a anonimização LGPD.

## LGPD e auditoria

**Direitos do titular**
- As rotas são `GET /lgpd/meus-dados` (exportação, sem `senhaHash`), `GET /lgpd/acessos` e `POST /lgpd/anonimizar`.
- O admin usa as variantes `/lgpd/:id/...`.
- Toda exportação ou anonimização grava um `AcessoDadoPessoal`.

**Anonimização**

É idempotente e roda numa única transação. Ela troca nome, e-mail, documentos e endereço por valores genéricos, gera uma senha aleatória e anonimiza os destinatários das notificações. Os condutores das reservas encerradas são apagados, e as linhas de negócio são preservadas.

Na prática é uma pseudonimização: o vínculo com a deficiência declarada (`deficienciaId`) é mantido, e o sistema não alega conformidade integral com a LGPD.

**Auditoria** (`RegistroAuditoria`)
- Grava só os campos operacionais que mudaram, nunca PII, senha, token ou cartão.
- Não tem chave estrangeira, para sobreviver à exclusão ou anonimização dos envolvidos.
- O gatilho `registro_auditoria_sem_update_delete` recusa UPDATE e DELETE.
- Em `GET /auditoria`, o locador vê os próprios registros e o admin vê todos.

## Imagens de veículos

**Validação**
- O upload é validado por tipo, tamanho e dimensões (`MEDIA_MAX_*`).
- O formato é conferido pela assinatura binária (JPEG, PNG, WebP), e imagens com metadados EXIF são recusadas por privacidade.
- O ciclo de status é `PENDING` → `READY` → `DELETING`.

**Armazenamento**
- Há dois buckets no MinIO local. Toda imagem vai para o privado.
- A cópia no bucket público, de leitura, só existe enquanto o veículo está `DISPONIVEL` numa garagem `ATIVA`. Ela é ressincronizada sob o lock do veículo.
- O navegador recebe só `MEDIA_PUBLIC_BASE_URL`, nunca o endpoint S3.

**Manutenção**
- `npm run media:init` cria os buckets e a política.
- `npm run media:cleanup` remove objetos órfãos com idade mínima de `MEDIA_CLEANUP_MIN_AGE_MINUTES`.

## Notificações e monitoramento

**Fluxo**
- service → notifier → template → `IMailProvider` → registro (`PENDENTE` → `ENVIADA`/`FALHA`).
- O notifier nunca lança: uma falha de envio não afeta a operação.
- O registro é gravado antes do envio, para existir mesmo se o processo cair.

**Tipos de notificação**
- **Relatório de reserva:** enviado ao confirmar o pagamento, com retry e backoff exponencial.
- **Veículo disponível:** só na transição para `DISPONIVEL`. Avisa quem registrou interesse e encerra a inscrição depois do envio aceito.
- **Alertas de veículo:** gerados pelo monitoramento (`MONITORAMENTO_VEICULOS=true`, a cada hora).
  - `INATIVIDADE`: veículo inativo há 7 dias ou mais.
  - `BAIXA_AVALIACAO`: média baixa numa janela de 90 dias.
  - Há um alerta ativo por tipo e veículo, resolvido sozinho quando a condição some.
  - O admin pode disparar em `POST /api/admin/monitoramento/executar`.

**Preferências**
- A ausência de preferência significa habilitado, e o opt-out é por canal e tipo.
- Só o e-mail tem provedor; push e SMS existem apenas na modelagem.

**Templates**
- HTML em tabelas de 600 px com CSS inline. As datas são exibidas em `TIMEZONE_EXIBICAO`; no banco e na API tudo fica em UTC.

Sem SMTP configurado, ou com `SEND_REAL_EMAIL=false`, o provedor fica desabilitado e nada é enviado.

## Rotas (base `/api`)

| Prefixo | Domínio |
| --- | --- |
| `/health`, `/ready` | liveness e readiness (`/ready` consulta o banco e responde 503 se ele cair) |
| `/basic` | status da API |
| `/conta` | registro atômico com perfil, login (JWT), recuperação e troca de senha, perfil, exclusão de conta |
| `/locador`, `/locatario` | perfis |
| `/admin` | operações administrativas (bloqueios, monitoramento) |
| `/deficiencia` | catálogo de deficiências |
| `/veiculo` | veículos, modelos, imagens e busca com filtros |
| `/garagem` | garagens e alocação de veículos |
| `/reserva` | listagem (`?status=A,B`), precificação, ciclo de vida, pagamento, condutores, desbloqueio (com QR), localização, compartilhamento, cancelamento e devolução |
| `/cobranca` | cobranças pendentes e pagamento |
| `/compartilhamento` | consulta pública de viagem compartilhada (`/:token`) |
| `/servico` | serviços opcionais |
| `/localizacao` | rastreamento |
| `/avaliacao` | avaliações e relatório do locador |
| `/favorito` | favoritos do locatário |
| `/interesse` | lista de interesse por disponibilidade |
| `/dashboard` | indicadores do locador (reservas, financeiro, utilização, frota) |
| `/notificacao` | preferências de notificação |
| `/lgpd` | meus dados, acessos e anonimização |
| `/auditoria` | consulta da trilha de auditoria |
| `/webhooks/pagamento/:provider` | webhook assinado do gateway sandbox |

## Pré-requisitos

- Node.js 20.19+ (o CI usa 24)
- Docker (PostgreSQL e MinIO)
- `minio.license` na pasta acima do repositório, só para o MinIO (imagem AIStor). O PostgreSQL sobe sem ela.

## Configuração inicial

```bash
npm install                    # também roda prisma generate
cp .env.example .env           # preencha JWT_SECRET; SMTP_* é opcional
npm run db:up                  # PostgreSQL em localhost:5433 (mova_dev e mova_test)
npm run db:migrate:deploy      # aplica as migrations no mova_dev
npm run db:migrate:test        # aplica as migrations no mova_test
npm run db:seed:demo -- --confirmar   # opcional e destrutivo: recria os dados de demonstração no mova_dev
npm run db:seed:demo:frota     # opcional: só acrescenta a frota extra e as fotos (não apaga dados)
npm run dev                    # API em http://localhost:3000/api
```

A porta 5433 é proposital, para não colidir com um PostgreSQL local na 5432.

O `seed-demo` só roda nesta situação:
- com `--confirmar`;
- com `NODE_ENV=development`;
- conectado de fato ao `mova_dev`.

Ele também grava posições de GPS fixas perto das garagens, para o desbloqueio funcionar com o simulador desligado.

Para imagens, suba o MinIO com `docker compose -f docker/docker-compose.yml --profile media up -d --wait` e rode `npm run media:init`. As credenciais padrão do MinIO são só locais e podem ser trocadas por `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`.

No Windows, `scripts/start-mova.ps1` sobe tudo em ordem (PostgreSQL → MinIO → backend → frontend), e `scripts/check-mova.ps1` confere o ambiente sem alterar nada. O `start-mova.ps1` aceita `-ComSimulador` e `-SemFrontend`, e não recria containers, não apaga volumes e não roda seed.

## Variáveis de ambiente

Os valores de exemplo estão em `.env.example`. Nunca versione o `.env`.

| Grupo | Variáveis |
| --- | --- |
| Banco | `DATABASE_URL`, `DIRECT_URL` (só o Prisma Migrate usa), `DATABASE_URL_TEST`, `DIRECT_URL_TEST` |
| Servidor | `SERVER_PORT`, `NODE_ENV`, `BODY_LIMIT`, `CORS_ORIGINS`, `TIMEZONE_EXIBICAO` |
| Autenticação | `JWT_SECRET` (também assina o QR), `JWT_EXPIRES_IN`, `PASSWORD_RESET_TTL_MINUTES`, `FRONTEND_URL` (link de redefinição de senha) |
| Rate limit | `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_WRITE_MAX` |
| Regras e jobs | `DESBLOQUEIO_RAIO_METROS`, `LOCALIZACAO_SIMULADOR`, `LOCALIZACAO_SIMULADOR_INTERVALO_MS`, `MONITORAMENTO_VEICULOS`, `MONITORAMENTO_INTERVALO_MS` |
| E-mail | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SEND_REAL_EMAIL` |
| Pagamento | `PAGAMENTO_SANDBOX_PROVIDER`, `PAGAMENTO_SIMULADOR_DELAY_MS`, `MERCADOPAGO_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`, `ASAAS_WEBHOOK_SECRET` |
| Mídia | `MEDIA_S3_ENDPOINT`, `MEDIA_S3_REGION`, `MEDIA_S3_FORCE_PATH_STYLE`, `MEDIA_S3_ACCESS_KEY_ID`, `MEDIA_S3_SECRET_ACCESS_KEY`, `MEDIA_PRIVATE_BUCKET`, `MEDIA_PUBLIC_BUCKET`, `MEDIA_PUBLIC_BASE_URL`, `MEDIA_MAX_BYTES`, `MEDIA_MAX_WIDTH`, `MEDIA_MAX_HEIGHT`, `MEDIA_MAX_IMAGES_PER_VEHICLE`, `MEDIA_CLEANUP_MIN_AGE_MINUTES` |

`LOCALIZACAO_SIMULADOR*`, `MONITORAMENTO_*` e `SEND_REAL_EMAIL` são lidas direto de `process.env`, fora da validação Zod de `src/config/env.ts`.

## Scripts

**npm**
- `npm run dev`: API em watch mode (tsx).
- `npm run build` / `npm start`: compila e sobe a versão de `dist/`.
- `npm test`, `npm run test:watch`, `npm run test:coverage`: Vitest.
- `npm run db:up` / `npm run db:down`: sobe e derruba o PostgreSQL local.
- `npm run db:migrate:deploy` / `npm run db:migrate:test`: migrations no banco de desenvolvimento e no de teste.
- `npm run db:seed`, `npm run db:seed:demo -- --confirmar`, `npm run db:reset`: seed básico, seed de demonstração (com imagens no MinIO) e reset.
- `npm run db:seed:demo:frota`: acrescenta a frota extra e as fotos que faltam a um `mova_dev` já populado, sem apagar nada (idempotente).
- `npm run media:init` / `npm run media:cleanup`: buckets do MinIO e limpeza de órfãos.

**PowerShell e Node**
- `scripts/backup-mova.ps1`: `pg_dump -Fc` a partir do container. Nunca sobrescreve um arquivo existente.
- `scripts/restore-mova.ps1`: restaura só em `mova_dev` ou `mova_restore_*` (nunca no `mova_test`) e pede o nome do banco digitado.
- `scripts/verify-backup-mova.ps1`: restaura num banco temporário, compara contagens e migrations e depois apaga esse banco.
- `node scripts/bench-mova.mjs [amostras] [saida.json]`: benchmark local, só com leituras e cotação de reserva.

## Testes

```bash
NODE_ENV=test SEND_REAL_EMAIL=false npx vitest run --dir test
```

**Ambiente**
- Integração via Supertest contra o `app` real, no banco `mova_test`.
- Antes de cada arquivo, `test/setup.ts` limpa as tabelas com `deleteMany`, em ordem de FK. A trilha de auditoria não é limpa, porque o gatilho recusa DELETE.
- A execução é em série: um worker, `pool: threads` (forks caíam no Windows nos testes de concorrência) e timeout de 30 s.

**Trava de segurança** (`src/config/test-environment.ts` + checagem de `current_database()`)
- Bloqueia a suíte se:
  - `NODE_ENV` não for `test`;
  - `SEND_REAL_EMAIL` não for `false` (o `.env.example` vem com `true`, por isso o comando acima define a variável);
  - o banco de teste não for `localhost:5433/mova_test`, ou coincidir com o de desenvolvimento.
- Nunca rode duas suítes ao mesmo tempo: elas compartilham o `mova_test`.

**Estratégia**
- Os testes geram CPF e CNH válidos. O admin é criado direto no banco e faz login pela API real.
- O pagamento é confirmado por webhook assinado (`assinarPayload`).
- A expiração é testada recuando `criadaEm`; nenhum teste espera 15 minutos.

**Suítes de destaque**
- `test/re-review`: ataques reais, como registro criando admin, elevação de cargo, IDOR, integridade financeira e a cadeia garagem → veículo → reserva.
- `test/concurrency` e `test/reserva/reserva-concorrente.test.ts`: locks e double-booking.
- `test/e2e/jornada-reserva-pagamento`: jornada completa sem nenhuma escrita direta no banco.
- `test/contrato`: contrato com o frontend.

**Dependências externas**
- O Nodemailer é mockado. O envio real é opt-in em `test/notificacao/real-email.test.ts` (`RUN_REAL_EMAIL_TEST=true` e SMTP configurado).
- `test/veiculo/veiculo-imagem-minio.test.ts` precisa do MinIO e de `MEDIA_S3_ACCESS_KEY_ID`/`MEDIA_S3_SECRET_ACCESS_KEY`.

**CI**

O CI (`.github/workflows/tests.yml`) roda a suíte com PostgreSQL e MinIO como serviços e publica o relatório Allure no GitHub Pages (com `MOVA_VITEST_ALLURE=1`). Na aba Suites, os testes aparecem agrupados por ator, entidade ou segmento. O grupo de cada arquivo fica em `test/allure-suites.ts`, e um teste falha se um arquivo novo ficar sem grupo.

## Créditos das fotos de demonstração

As fotos em `prisma/assets/veiculos/` são usadas só pelo seed de demonstração (`prisma/scripts/seed-demo.ts` e `prisma/scripts/demo-frota.ts`).

- **Origem:** Wikimedia Commons, em licenças livres que permitem reprodução com atribuição.
- **Arquivos:** são a miniatura oficial de 1.280 px gerada pelo próprio Commons, sem recompressão.
- **Alteração feita:** só foram removidos os metadados (EXIF/XMP/IPTC), que o backend recusa por privacidade. Os pixels não mudaram.
- **Fora desta lista:** as 4 fotos antigas (Onix, Argo, HB20, Civic) ficam em `mova-frontend/src/assets/`.

| Arquivo | Veículo no MOVA | Obra original (Commons) | Autor | Licença | SHA-256 |
|---|---|---|---|---|---|
| `byd-dolphin.jpg` | BYD Dolphin | [BYD Dolphin IAA 2023 1X7A0634.jpg](https://commons.wikimedia.org/wiki/File:BYD_Dolphin_IAA_2023_1X7A0634.jpg) | Alexander-93 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `785a0f3e94a3676f…` |
| `chevrolet-spin.jpg` | Chevrolet Spin | [2019 Chevrolet Spin (Arequipa, Perú).jpg](https://commons.wikimedia.org/wiki/File:2019_Chevrolet_Spin_(Arequipa,_Per%C3%BA).jpg) | Parked in aqp | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `c60483acd0925834…` |
| `chevrolet-spin-adaptada.jpg` | Chevrolet Spin Adaptada | [2013 Chevrolet Spin 1.5 LTZ (20190616).jpg](https://commons.wikimedia.org/wiki/File:2013_Chevrolet_Spin_1.5_LTZ_(20190616).jpg) | オーバードライブ83 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `28d68c5a52d1ce8b…` |
| `fiat-mobi.jpg` | Fiat Mobi | [Fiat Mobi Like 1.0 Fire flex.jpg](https://commons.wikimedia.org/wiki/File:Fiat_Mobi_Like_1.0_Fire_flex.jpg) | Heduardo55 | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | `9932623dfcc46908…` |
| `toyota-corolla.jpg` | Toyota Corolla | [CorollaAltisZRE211V20WhitePearlFR.jpg](https://commons.wikimedia.org/wiki/File:CorollaAltisZRE211V20WhitePearlFR.jpg) | Celica21gtfour | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `2d799770995208d0…` |
| `renault-kwid.jpg` | Renault Kwid | [Renault Kwid 2017 in Montevideo (front).jpg](https://commons.wikimedia.org/wiki/File:Renault_Kwid_2017_in_Montevideo_(front).jpg) | NaBUru38 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `2278c729bdf5f21f…` |
| `volkswagen-polo.jpg` | Volkswagen Polo | [Volkswagen Polo VI GTI DSC 7036.jpg](https://commons.wikimedia.org/wiki/File:Volkswagen_Polo_VI_GTI_DSC_7036.jpg) | Alexander-93 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `bd9ba8d4ec4c44ed…` |
| `jeep-commander.png` | Jeep Commander | [2021 Jeep Commander Limited (Brazil) front view.png](https://commons.wikimedia.org/wiki/File:2021_Jeep_Commander_Limited_(Brazil)_front_view.png) | Garagem do Jabulas | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0) | `340ebfdf163b6833…` |
| `jeep-compass.jpg` | Jeep Compass | [Jeep Compass (MP) PHEV Facelift 1X7A0140.jpg](https://commons.wikimedia.org/wiki/File:Jeep_Compass_(MP)_PHEV_Facelift_1X7A0140.jpg) | Alexander Migl | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `60f66fd723df6978…` |
| `volkswagen-jetta.jpg` | Volkswagen Jetta | [Jetta 07-07-2019.jpg](https://commons.wikimedia.org/wiki/File:Jetta_07-07-2019.jpg) | SsmIntrigue | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `0fd6ec059ed73852…` |
| `fiat-doblo-adaptado.jpg` | Fiat Doblò Adaptado | [2017 Fiat Doblo (263 Series II) SWB van (2018-09-03) 01.jpg](https://commons.wikimedia.org/wiki/File:2017_Fiat_Doblo_(263_Series_II)_SWB_van_(2018-09-03)_01.jpg) | EurovisionNim | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `2d0b6bcd9f1e3972…` |
| `chevrolet-trailblazer.jpg` | Chevrolet Trailblazer | [2017 Chevrolet Trailblazer LTZ.jpg](https://commons.wikimedia.org/wiki/File:2017_Chevrolet_Trailblazer_LTZ.jpg) | Greg Gjerdingen | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | `87edccdb3456b5cd…` |
| `volkswagen-tiguan-allspace.jpg` | Volkswagen Tiguan Allspace | [Volkswagen Tiguan Allspace FL 1X7A0302.jpg](https://commons.wikimedia.org/wiki/File:Volkswagen_Tiguan_Allspace_FL_1X7A0302.jpg) | Alexander Migl | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `39bd737f59cb2366…` |
| `volkswagen-virtus-adaptado.jpg` | Volkswagen Virtus Adaptado | [2023 Volkswagen Virtus Topline front 20230520.jpg](https://commons.wikimedia.org/wiki/File:2023_Volkswagen_Virtus_Topline_front_20230520.jpg) | Dairokkan9 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `1b6ef76d130b3285…` |
| `gwm-ora-03.jpg` | GWM Ora 03 | [ORA Funky Cat 1X7A0814.jpg](https://commons.wikimedia.org/wiki/File:ORA_Funky_Cat_1X7A0814.jpg) | Alexander-93 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `f07ff4b726d432f6…` |
| `volvo-ex30.jpg` | Volvo EX30 | [Volvo EX30 Auto Zuerich 2023 1X7A0949.jpg](https://commons.wikimedia.org/wiki/File:Volvo_EX30_Auto_Zuerich_2023_1X7A0949.jpg) | Alexander-93 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `7e32db1ff840827d…` |
| `byd-dolphin-mini.jpg` | BYD Dolphin Mini | [BYD Dolphin Surf IAA 2025 DSC 2256.jpg](https://commons.wikimedia.org/wiki/File:BYD_Dolphin_Surf_IAA_2025_DSC_2256.jpg) | Alexander-93 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | `c1c7592f2406614b…` |

## Licença

Projeto acadêmico (FATEC). As fotos de demonstração seguem as licenças indicadas acima.

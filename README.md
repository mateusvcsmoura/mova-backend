# MOVA - Backend

API REST em Node.js + TypeScript da plataforma MOVA de locação de veículos por demanda. Produto final do TCC junto com `mova-frontend`. Roda inteiramente local: PostgreSQL e MinIO em Docker, pagamentos em sandbox simulado e e-mail via SMTP opcional.

Cobre contas com RBAC (locatário, locador, admin), catálogo de veículos com imagens, garagens, reservas com pagamento e código de desbloqueio, condutores adicionais, serviços opcionais, cobranças avulsas, compartilhamento de viagem, avaliações, favoritos, lista de interesse, bloqueio de locatários, rastreamento e monitoramento simulados, dashboard do locador, LGPD, trilha de auditoria e notificações.

## Stack

- Node.js + TypeScript (ESM), Express 5
- PostgreSQL 16 + Prisma ORM 7 (`@prisma/adapter-pg`)
- Zod (validação), JWT + bcrypt (autenticação)
- Helmet, CORS e `express-rate-limit` (segurança)
- MinIO local (imagens de veículos) via `@aws-sdk/client-s3`, que é só o cliente S3; não há conta AWS
- Nodemailer (SMTP)
- Vitest + Supertest (testes), Allure (relatórios no CI)

## Arquitetura

Camadas com injeção de dependências manual. O composition root fica em `src/routes/container.ts`, e cada camada depende de interfaces, nunca de implementações concretas:

```
Router -> Middlewares -> Controller -> Service -> IRepository -> Prisma -> PostgreSQL
                            |             |
                       schemas Zod    infra (e-mail, mídia, pagamento) e notifiers
```

- **Routes** (`src/routes/`): um diretório por domínio; aplicam `authMiddleware` (JWT) e `authorize(<Cargo>)` (RBAC).
- **Controllers** (`src/controllers/`): validam a requisição com Zod e delegam ao service. Sem regra de negócio.
- **Services** (`src/services/`): toda a regra de negócio. Payloads em `services/contracts/`.
- **Repositories** (`src/repositories/`): interfaces `I*Repository` na raiz, DTOs em `contracts/`, implementações Prisma em `prisma/`, conversão em `mappers/`.
- **Infra** (`src/infra/`): adaptadores externos atrás de interfaces.
  - `email/`: `IMailProvider` + Nodemailer.
  - `media/`: `StorageProvider` S3 (MinIO), validação de imagem e limpeza de órfãos.
  - `payment/`: gateway sandbox que simula Mercado Pago, Stripe e Asaas, com auditoria dos eventos financeiros.
- **Middlewares** (`src/middlewares/`): `observability` (request id + log estruturado), `locale` (`Accept-Language`), `rate-limit` (auth, escrita e webhooks), `auth-middleware`, `authorization-middleware`, `api-version` e `error-handler`.
- **Templates** (`src/templates/`): funções puras que geram `{ subject, html, text }` dos e-mails (relatório de reserva, veículo disponível, alerta de veículo).
- **i18n** (`src/i18n/`): mensagens da API em pt-BR, en e es, escolhidas pelo `Accept-Language`.
- **Shared** (`src/shared/`): paginação, logger, retry, advisory lock, documentos (CPF/CNPJ) e prazo de pagamento.
- **Errors** (`src/errors/`): `HttpError`, propagado via `next(error)` e traduzido pelo `error-handler`.

## Estrutura do projeto

```
src/
  app.ts               # montagem do Express, middlewares e routers
  server.ts            # boot (porta, simulador de GPS e monitoramento opcionais)
  config/              # leitura/validação do ambiente (Zod) e trava do ambiente de teste
  database/prisma.ts   # cliente Prisma
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
  migrations/          # SQL versionado
  scripts/             # seed, seed-demo, reset, media-init, media-cleanup
docker/
  docker-compose.yml   # PostgreSQL e MinIO (perfil "media")
  postgres-init/       # cria o banco mova_test na primeira inicialização
scripts/               # PowerShell: start, check, backup, restore; bench-mova.mjs
test/                  # suítes por domínio (Vitest + Supertest)
docs/codigo/           # notas de implementação por área
```

## Domínio (Prisma)

- **Conta** (RBAC via enum `Cargo`) com perfis 1:1 **Locatario** (CPF/CNH, deficiência opcional) e **Locador** (empresa/CNPJ); **Deficiencia** (catálogo); **RecuperacaoSenha**.
- **ModeloVeiculo** (com `CategoriaVeiculo`), **Veiculo** (placa, `StatusVeiculo`, garagem atual), **VeiculoImagem** e **VeiculoStatusHistorico**.
- **Garagem** (capacidade, acessibilidade, `StatusGaragem`): retirada e devolução das reservas.
- **Reserva** (período, valores, `StatusReserva` + `StatusPagamento`, código de desbloqueio gerado na confirmação do pagamento), com **ServicoOpcional**/**ReservaServico**, **CondutorAdicional**, **CobrancaReserva** (multas), **CompartilhamentoReserva** e **EventoFinanceiroSandbox**.
- **Avaliacao** (1:1 com reserva realizada), **Favorito** e **InteresseVeiculo** + **NotificacaoInteresse**.
- **NotificacaoReserva** e **PreferenciaNotificacao** (canais e tipos por conta).
- **BloqueioLocatario** (motivos, expiração e revogação; consultado na criação e confirmação de reservas).
- **Localizacao** (histórico de posições) e **AlertaVeiculo** (monitoramento).
- **AcessoDadoPessoal** (LGPD) e **RegistroAuditoria** (trilha somente leitura; o banco recusa UPDATE/DELETE por gatilho).

## Rotas (base `/api`)

| Prefixo | Domínio |
| --- | --- |
| `/health`, `/ready` | liveness e readiness (consulta o banco) |
| `/basic` | status da API |
| `/conta` | registro atômico com perfil, login (JWT), recuperação e troca de senha, perfil, exclusão de conta |
| `/locador`, `/locatario` | perfis |
| `/admin` | operações administrativas (ex.: bloqueios) |
| `/deficiencia` | catálogo de deficiências |
| `/veiculo` | veículos, modelos, imagens e busca com filtros |
| `/garagem` | garagens e alocação de veículos |
| `/reserva` | precificação, ciclo de vida, pagamento, condutores, desbloqueio (com QR), localização, compartilhamento, cancelamento e devolução |
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

Listagens são paginadas (`?page=&limit=`) e respondem `{ result, pagination }`. Toda resposta traz o header `X-Request-Id`, e os logs são JSON estruturado por evento.

## Pagamentos (sandbox)

Não há gateway real. `PAGAMENTO_SANDBOX_PROVIDER` escolhe qual gateway é simulado (`mercadopago`, `stripe` ou `asaas`). A confirmação chega pelo webhook assinado com o segredo do respectivo gateway (`*_WEBHOOK_SECRET`); sem segredo, o webhook é rejeitado. Estornos são idempotentes, com retentativa.

## Imagens de veículos

O upload é validado (tipo, tamanho e dimensões, ver `MEDIA_MAX_*`) e gravado no MinIO local. Há dois buckets: um privado e um público, de leitura. O navegador recebe só `MEDIA_PUBLIC_BASE_URL`, nunca o endpoint S3. `npm run media:init` cria os buckets e a política; `npm run media:cleanup` remove objetos órfãos.

## Notificações

Fluxo: service → notifier (nunca lança; falha não afeta a operação) → template → `IMailProvider` → registro de auditoria (PENDENTE → ENVIADA/FALHA).

- **Relatório de reserva**: enviado ao confirmar o pagamento.
- **Veículo disponível**: quando o veículo volta a `DISPONIVEL`, avisa quem registrou interesse e encerra a inscrição após o envio.
- **Alertas de veículo**: gerados pelo monitoramento (`MONITORAMENTO_VEICULOS=true`).

Sem SMTP configurado, o provedor fica desabilitado e nada é enviado.

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
npm run db:seed:demo           # opcional: dados de demonstração
npm run dev                    # API em http://localhost:3000/api
```

Para imagens, suba o MinIO com `docker compose -f docker/docker-compose.yml --profile media up -d --wait` e rode `npm run media:init`. As credenciais padrão do MinIO são locais (`mova`/`mova-minio`) e podem ser trocadas por `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`.

No Windows, `scripts/start-mova.ps1` sobe tudo em ordem (PostgreSQL → MinIO → backend → frontend) e `scripts/check-mova.ps1` confere o ambiente.

## Scripts

- `npm run dev`: API em watch mode (tsx)
- `npm run build` / `npm start`: compila e sobe a versão de `dist/`
- `npm test`, `npm run test:watch`, `npm run test:coverage`: Vitest
- `npm run db:up` / `npm run db:down`: sobe/derruba o PostgreSQL local
- `npm run db:migrate:deploy` / `npm run db:migrate:test`: migrations no banco de desenvolvimento / de teste
- `npm run db:seed`, `npm run db:seed:demo`, `npm run db:reset`: seed básico, seed de demonstração (com imagens no MinIO) e reset
- `npm run media:init` / `npm run media:cleanup`: buckets do MinIO / limpeza de órfãos
- `scripts/backup-mova.ps1`, `restore-mova.ps1`, `verify-backup-mova.ps1`: backup local do PostgreSQL
- `node scripts/bench-mova.mjs`: benchmark local das operações principais

## Testes

```bash
NODE_ENV=test SEND_REAL_EMAIL=false npx vitest run --dir test
```

- Integração via Supertest contra o `app` real, no banco `mova_test`. Cada arquivo trunca o banco antes de rodar, e a execução é em série.
- Uma trava (`src/config/test-environment.ts`) bloqueia a suíte se `SEND_REAL_EMAIL` não for `false` ou se o banco de teste for o mesmo de desenvolvimento.
- Nodemailer é mockado; o envio real é opt-in em `test/notificacao/real-email.test.ts`.
- `test/veiculo/veiculo-imagem-minio.test.ts` precisa do MinIO e de `MEDIA_S3_ACCESS_KEY_ID`/`MEDIA_S3_SECRET_ACCESS_KEY`.
- Nunca rode duas suítes ao mesmo tempo: elas compartilham o `mova_test`.

O CI (`.github/workflows/tests.yml`) roda a suíte com PostgreSQL e MinIO como serviços e publica o relatório Allure no GitHub Pages.

## Licença

Projeto acadêmico (FATEC).

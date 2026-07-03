# Mova Backend

API REST em Node.js + TypeScript para uma plataforma de aluguel de veículos: contas com RBAC (locatário, locador, admin), catálogo de veículos e garagens, reservas com pagamento e código de desbloqueio, serviços opcionais, avaliações, favoritos, watchlist de disponibilidade, bloqueio de locatários, rastreamento (simulado) e notificações por e-mail.

## Stack

- Node.js + TypeScript (ESM)
- Express 5
- Prisma ORM (PostgreSQL)
- Zod (validação)
- JWT (`jsonwebtoken`) + bcrypt (autenticação)
- Nodemailer (e-mails transacionais)
- Vitest + Supertest (testes)

## Arquitetura

Arquitetura em camadas com injeção de dependências manual (composition root em `src/routes/container.ts`). Cada camada depende apenas de contratos (interfaces), nunca de implementações concretas:

```
Router -> Middlewares (auth/authorize) -> Controller -> Service -> IRepository -> PrismaRepository -> DB
                                             |             |
                                        Zod schemas   contratos/notifiers (e-mail etc.)
```

- **Routes** (`src/routes/`): definição das rotas HTTP por domínio; aplicam `authMiddleware` (JWT) e `authorize(<Cargo>)` (RBAC).
- **Controllers** (`src/controllers/`): parse/validação da requisição (Zod), extração do usuário autenticado (`req.user`), delegação ao service. Nunca contêm regra de negócio.
- **Services** (`src/services/`): toda a regra de negócio. Recebem repositórios (e notifiers) por interface no construtor.
- **Repositories** (`src/repositories/`): interfaces (`I*Repository`) na raiz, DTOs em `contracts/`, implementações Prisma em `prisma/`, conversão entidade→DTO em `mappers/`. Consultas usam `include`/índices para evitar N+1.
- **Infra** (`src/infra/`): adaptadores externos. E-mail atrás de `IMailProvider` (`infra/email/`) — trocar Nodemailer por SES/Resend é criar outra implementação e trocar o registro no container.
- **Templates** (`src/templates/`): funções puras payload → `{ subject, html, text }`, fora da regra de negócio.
- **Middlewares** (`src/middlewares/`): `auth-middleware` (Bearer JWT → `req.user`), `authorization-middleware` (cargos), `api-version` (metadados), `error-handler` (traduz `HttpError` em resposta JSON).
- **Shared** (`src/shared/`): paginação padrão (`page`/`limit`, `PaginatedResult`).
- **Errors** (`src/errors/HttpError.ts`): erro de negócio com status HTTP, propagado via `next(error)`.

## Estrutura do projeto

```
prisma/
  schema.prisma        # modelos, enums, índices e constraints
  migrations/          # SQL versionado (migrate deploy)
  scripts/             # seed.ts / reset.ts
src/
  app.ts               # montagem do Express e dos routers
  server.ts            # boot (porta, simulador de localização opcional)
  config/env.ts        # leitura/validação das variáveis de ambiente
  database/prisma.ts   # cliente Prisma singleton
  routes/              # um diretório por domínio + container.ts (DI)
  controllers/
  services/            # regra de negócio (+ services/contracts/ p/ payloads)
  repositories/        # interfaces + contracts/ + mappers/ + prisma/
  schemas/             # validações Zod por domínio
  templates/           # e-mails (relatório de reserva, veículo disponível)
  infra/email/         # IMailProvider + NodemailerMailProvider
  middlewares/
  shared/              # paginação
  errors/
test/                  # suites por domínio (Vitest + Supertest)
```

## Domínio (Prisma)

- **Conta** (RBAC via enum `Cargo`) com perfis 1:1 **Locatario** (CPF/CNH, deficiência opcional) e **Locador** (empresa/CNPJ).
- **ModeloVeiculo** (catálogo por locador) e **Veiculo** (placa, `StatusVeiculo`: DISPONIVEL/RESERVADO/MANUTENCAO/INATIVO, garagem atual).
- **Garagem** (capacidade, acessibilidade) — retirada/devolução das reservas.
- **Reserva** (período, valores, `StatusReserva` + `StatusPagamento`, código de desbloqueio gerado na confirmação do pagamento) + **ServicoOpcional**/**ReservaServico** (catálogo N:N com snapshot de valor).
- **Avaliacao** (1:1 com reserva realizada).
- **Favorito** (N:N locatário↔veículo, par único).
- **InteresseVeiculo** (watchlist de disponibilidade, par único com ciclo ATIVO/CANCELADO/NOTIFICADO) + **NotificacaoInteresse** (auditoria dos envios).
- **NotificacaoReserva** (auditoria do relatório de reserva por e-mail, `StatusNotificacao`).
- **BloqueioLocatario** (motivos extensíveis, expiração/revogação, consultado na criação/confirmação de reservas).
- **Localizacao** (histórico lat/long por veículo; simulador opcional no boot).

## Rotas (base `/api`)

| Prefixo | Domínio |
| --- | --- |
| `/basic` | health/infra |
| `/conta` | registro, login (JWT), gestão de contas |
| `/locador`, `/locatario` | perfis |
| `/admin` | operações administrativas (ex.: bloqueios) |
| `/deficiencia` | catálogo de deficiências |
| `/veiculo` | CRUD de veículos e modelos, busca com filtros |
| `/garagem` | garagens e alocação de veículos |
| `/reserva` | ciclo de vida da reserva, pagamento, desbloqueio |
| `/servico` | serviços opcionais |
| `/localizacao` | rastreamento |
| `/avaliacao` | avaliações de reservas |
| `/favorito` | favoritos do locatário autenticado |
| `/interesse` | watchlist de disponibilidade do locatário autenticado |

Listagens são paginadas (`?page=&limit=`) e respondem `{ result, pagination }`.

## Notificações por e-mail

Fluxo comum: service de negócio → notifier (nunca lança; falha não afeta a operação) → template puro → `IMailProvider` → registro de auditoria (PENDENTE → ENVIADA/FALHA).

- **Relatório de reserva**: enviado ao confirmar o pagamento (`NotificacaoReservaService`).
- **Veículo disponível**: locatários registram interesse (`POST /api/interesse`); quando o status do veículo transiciona para `DISPONIVEL`, o `NotificacaoVeiculoDisponivelService` notifica todas as inscrições ativas e as encerra após envio bem-sucedido (falha mantém a inscrição ativa para nova tentativa). Canais futuros (push/SMS/WhatsApp) entram como novas implementações atrás dos mesmos contratos.

Sem SMTP configurado o provedor fica desabilitado e nada é enviado (dev/testes).

## Pré-requisitos

- Node.js 18+
- PostgreSQL

## Configuração inicial

```bash
npm install
cp .env.example .env      # preencha DATABASE_URL, JWT_SECRET, SMTP_* (opcional)
npx prisma generate
npx prisma migrate deploy # aplica as migrations no banco do .env
npm run db:seed           # opcional: dados iniciais
```

Desenvolvimento:

```bash
npm run dev
```

Produção:

```bash
npm run build
npm start
```

## Scripts

- `npm run dev` — API em watch mode (tsx)
- `npm run build` / `npm start` — compila e sobe a versão de `dist/`
- `npm test` / `npm run test:watch` — Vitest
- `npm run db:seed` / `npm run db:reset` — seed/reset do banco
- `npm run db:migrate:test` — `migrate deploy` no banco de teste (`DATABASE_URL_TEST`)

## Testes

- Integração via Supertest contra o `app` real (banco de teste dedicado; cada arquivo limpa o estado no `beforeAll`, execução em série).
- Unitários com fakes/mocks para a camada de notificação (Nodemailer é mockado — nenhum e-mail real é enviado; envio real é opt-in em `test/notificacao/real-email.test.ts`).
- Requer `DATABASE_URL_TEST` configurada e migrations aplicadas (`npm run db:migrate:test`).

## Observações

- A versão da API é exposta via middleware (`v1.0.0`).
- `LOCALIZACAO_SIMULADOR=true` liga o simulador de rastreador GPS no boot (intervalo via `LOCALIZACAO_SIMULADOR_INTERVALO_MS`).

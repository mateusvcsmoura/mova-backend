# Notas de implementação — Configuração do repositório

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `.env.example`

**`DATABASE_URL="postgresql://mova:mova@localhost:5433/mova_dev"`**

BANCOS DE DADOS
Ver auditoria/AMBIENTES.md para a arquitetura completa dos ambientes.

A escolha de qual par de variaveis o processo usa e feita em
src/database/prisma.ts a partir de NODE_ENV:
NODE_ENV=test          -> DATABASE_URL_TEST / DIRECT_URL_TEST
qualquer outro valor   -> DATABASE_URL      / DIRECT_URL

DATABASE_URL e o que a aplicacao consome em runtime; DIRECT_URL e usada apenas
pelo Prisma Migrate (ver prisma.config.ts). No Postgres local as duas sao
iguais (projeto 100% local).

**`DATABASE_URL="postgresql://mova:mova@localhost:5433/mova_dev"`**

Desenvolvimento local. Padrao: banco mova_dev do Postgres em container
(npm run db:up).

**`DATABASE_URL_TEST="postgresql://mova:mova@localhost:5433/mova_test"`**

Suite automatizada (npm test). Banco EXCLUSIVO dos testes.
ATENCAO: test/setup.ts TRUNCA todas as tabelas deste banco antes de CADA
arquivo de teste. Nunca aponte para um banco cujos dados voce precise manter.

**`NODE_ENV=`**

development | test | production
Use "development" no .env local. O vitest define NODE_ENV=test sozinho ao
rodar a suite; nao e preciso (nem desejavel) fixar "test" aqui.

**`CORS_ORIGINS=`**

Segurança HTTP (hardening RNF05).
Origens permitidas pelo CORS, separadas por vírgula. Nunca use "\*".
Em branco = whitelist de desenvolvimento (localhost:3000, localhost:5173).

**`TIMEZONE_EXIBICAO=America/Sao_Paulo`**

Fuso usado para EXIBIR data/hora a humanos (e-mails/relatórios). Nao afeta
armazenamento nem comparacao: instantes trafegam e sao gravados em UTC.
Padrao: America/Sao_Paulo. Ver auditoria/DATAS-HORARIOS.md.

**`DESBLOQUEIO_RAIO_METROS=100`**

RN03: raio (metros) do geofence de desbloqueio (padrão 100). Sem localização
de referência do veículo, o geofence é ignorado.

**`MONITORAMENTO_VEICULOS=`**

Monitoramento da frota (alertas de inatividade/baixa avaliação por e-mail).
"true" liga a rotina periódica no boot; intervalo em ms (padrão 1h).

**`SMTP_HOST=smtp.gmail.com`**

SMTP (Nodemailer). Para o Gmail use uma App Password (não a senha da conta).
Deixe em branco para desabilitar o envio de e-mails (dev/testes).

**`PAGAMENTO_SANDBOX_PROVIDER=mercadopago`**

Sandbox de pagamento. O simulador assina o webhook com o segredo do gateway
escolhido e o entrega pelo mesmo caminho de um gateway real.
PAGAMENTO_SANDBOX_PROVIDER: mercadopago | stripe | asaas (padrao mercadopago)
PAGAMENTO_SIMULADOR_DELAY_MS: atraso da entrega em ms (padrao 1500; 0 em teste)

**`MERCADOPAGO_WEBHOOK_SECRET=`**

Segredos de assinatura dos webhooks de pagamento (um por gateway). Sem
valor = o gateway correspondente rejeita todo webhook (nao ha como validar).

**`MEDIA_S3_ENDPOINT=http://localhost:9000`**

Imagens de veículos. MEDIA_S3_ENDPOINT é somente o endpoint S3 interno usado
pelo backend; nunca o entregue ao browser. MEDIA_PUBLIC_BASE_URL é a URL de
leitura gerada nos DTOs. Em local, o backend roda no host e usa localhost.

**`MEDIA_MAX_BYTES=5242880`**

O console administrativo local é http://127.0.0.1:9001; não é usado pelo
backend.

## `docker/docker-compose.yml`

**`services:`**

Postgres local para desenvolvimento e testes do MOVA.
Ver auditoria/AMBIENTES.md.

`npm run db:up      sobe o banco`

`npm run db:down    derruba (mantendo os dados)`

Porta 5433 de proposito, para nao colidir com um Postgres ja instalado na 5432.

## `docker/postgres-init/01-cria-banco-de-teste.sql`

**`CREATE DATABASE mova_test OWNER mova;`**

Alem do mova_dev (criado por POSTGRES_DB), cria o banco exclusivo da suite.
Assim os testes truncam tabelas que nao pertencem a nenhum outro ambiente.

## `vitest.config.js`

**`pool: "threads",`**

Worker forks encerram inesperadamente no Windows após testes de
concorrência PostgreSQL; threads preserva execução serial estável.

**`testTimeout: 30_000,`**

30s (era 20s): há cenários de concorrência contra o Postgres local que
ultrapassam 20s em Windows. Não muda regra de negócio.

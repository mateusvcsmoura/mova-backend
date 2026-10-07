# Notas de implementação — Scripts (scripts/)

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `scripts/backup-mova.ps1`

**`param(`**

Backup LOCAL do PostgreSQL do MOVA (RNF10).

`powershell -ExecutionPolicy Bypass -File scripts\backup-mova.ps1 [-Banco mova_dev] [-Pasta backups]`

Gera backups\&lt;banco>_&lt;aaaa-MM-dd_HHmmss>.dump (pg_dump -Fc) a partir do
container local mova-postgres. Não usa senha (socket local do container) e
nunca sobrescreve um arquivo existente. backups/ e \*.dump são ignorados pelo Git.

## `scripts/bench-mova.mjs`

**`import { cpus, totalmem, platform, release } from "node:os";`**

RNF03 — benchmark local reproduzível das operações principais (HTTP real,
loopback, API em mova_dev com o seed de demonstração). Não grava dados:
só leituras e a cotação de reserva.

`node scripts/bench-mova.mjs [amostras=50] [saida.json]`

MOVA_API (padrão http://localhost:3000/api), MOVA_DEMO_PASSWORD.

**`const N_LOGIN = Math.min(N, 6);`**

Login usa bcrypt e tem rate limit (10/15 min por IP no .env padrão): poucas amostras.
2 logins de preparo + 1 de aquecimento + 6 amostras = 9 por execução.

## `scripts/check-mova.ps1`

**`$falhas = 0`**

Verificação rápida do ambiente LOCAL do MOVA (somente leitura).

`powershell -ExecutionPolicy Bypass -File scripts\check-mova.ps1`

Sai com código 1 se algum item falhar.

## `scripts/restore-mova.ps1`

**`param(`**

Restore LOCAL do PostgreSQL do MOVA (RNF10). DESTRUTIVO para o banco alvo.

`powershell -ExecutionPolicy Bypass -File scripts\restore-mova.ps1 -Arquivo backups\mova_dev_....dump [-Banco mova_dev]`

Segurança:
- só restaura no container local mova-postgres (nunca em URL/banco remoto);
- bancos permitidos: mova_dev (padrão) ou bancos temporários mova_restore_\*;
mova_test é sempre recusado (os testes o recriam);
- pede que o nome do banco seja digitado para confirmar (ou -Confirmar &lt;nome>
para uso não interativo, que precisa repetir exatamente o nome do banco);
- bancos mova_restore_\* inexistentes são criados.

## `scripts/start-mova.ps1`

**`param(`**

Sobe o ambiente LOCAL de demonstração do MOVA (TCC):
PostgreSQL (Docker) -> MinIO AIStor (Docker) -> backend (mova_dev) -> frontend (Vite)

`powershell -ExecutionPolicy Bypass -File scripts\start-mova.ps1 [-ComSimulador] [-SemFrontend]`

O que este script NÃO faz: não recria containers, não remove volumes, não
reseta o banco e não roda seed. Dados de demonstração: npm run db:seed:demo -- --confirmar
Backend e frontend abrem em janelas próprias, com os logs visíveis.

**`if (-not $env:RATE_LIMIT_AUTH_MAX) { $env:RATE_LIMIT_AUTH_MAX = "200" }`**

Demo alterna várias contas na mesma máquina: o limite de login (10 por 15 min
por IP) travaria a apresentação. O rate limit continua ativo, só mais folgado.

## `scripts/verify-backup-mova.ps1`

**`param([string]$Container = "mova-postgres")`**

Prova de recuperação SEM tocar em mova_dev (RNF10):
backup de mova_dev -> restore em banco temporário mova_restore_&lt;carimbo> ->
compara contagens de linhas e migrations -> remove o banco temporário.

`powershell -ExecutionPolicy Bypass -File scripts\verify-backup-mova.ps1`

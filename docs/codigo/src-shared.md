# Notas de implementação — src/shared

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `src/shared/advisory-lock.ts`

**`export const LOCK_MONITORAMENTO = 4101;`**

Chaves de advisory lock do PostgreSQL. Cada job periódico tem uma chave fixa
e distinta — instâncias diferentes competem pela mesma chave, garantindo que
só uma execute o tick por vez (sem Redis, sem dependência externa).

**`const LOCK_TX_TIMEOUT_MS = 120_000;`**

Timeout da transação que segura o lock enquanto `fn` roda. Precisa cobrir a
duração do tick mais pesado; se estourar, a transação aborta e o lock é
liberado antes da hora.
ponytail: timeout global fixo; se um tick passar disso, subir o valor aqui.

**`export async function runExclusive(`**

Executa `fn` sob um advisory lock de transação do PostgreSQL, garantindo que
apenas uma instância rode o bloco por vez (`pg_try_advisory_xact_lock` é
não-bloqueante: quem não pega o lock simplesmente pula).

A transação interativa fixa uma única conexão do pool — assim o lock é
adquirido e liberado na mesma sessão — e o lock cai automaticamente ao fim da
transação, mesmo em erro/crash. `fn` faz seu próprio trabalho de escrita pela
conexão global normal; a transação aqui existe só para segurar o mutex.

@returns `true` se pegou o lock e executou; `false` se outra instância já
estava executando (tick pulado).

## `src/shared/documentos.ts`

**`function apenasDigitos(v: string): string {`**

Validadores de documentos brasileiros (dígitos verificadores reais).
Usados nas validações Zod para rejeitar números com formato válido mas
checksum inválido (ex.: CPF "11111111111" ou sequência arbitrária).

## `src/shared/logger.ts`

**`type LogLevel = "info" | "warn" | "error";`**

Logger estruturado mínimo (sem dependências externas). Emite uma linha JSON
por evento — formato amigável para coletores de log (Datadog, Loki, CloudWatch).
O projeto não possuía logger; este centraliza a saída em vez de console.\* solto.

Silenciado em NODE_ENV=test para não poluir a saída da suíte (a suíte roda
centenas de requisições). A instrumentação — request id, tempo, status —
continua ativa; apenas a escrita no console é suprimida nos testes.

## `src/shared/pagination.ts`

**`export const paginationQuerySchema = z.object({`**

Valida/coage os parâmetros page e limit vindos da query string.
Campos extras (filtros) são ignorados, então pode ser aplicado direto em req.query.

**`export function toPaginationMeta(result: {`**

Extrai apenas os metadados (sem os dados) — usado na resposta do controller:
res.json({ result: data, pagination: meta }).

## `src/shared/prazo-pagamento.ts`

**`export const PRAZO_PAGAMENTO_MINUTOS = 15;`**

Task 10 (D10-02/D10-03): prazo ÚNICO de pagamento. Uma reserva
AGUARDANDO_PAGAMENTO retém o veículo, e uma tentativa PROCESSANDO vale, por
no máximo 15 minutos. É uma regra de negócio, não configuração de ambiente.

Instantes absolutos (Date/epoch), sem fuso: o TTL não depende de
America/Sao_Paulo. `agora` é injetável para os testes não esperarem 15 min.

## `src/shared/retry.ts`

**`export async function retryComBackoff<T>(`**

Executa `fn` com retry e backoff exponencial. Reexecuta enquanto `fn` lançar,
respeitando o teto de tentativas; entre as tentativas espera baseMs\*fator^(n-1).
Repassa o último erro se todas falharem. Para I/O idempotente (ex.: envio de
e-mail), onde uma falha transitória de rede não deve derrubar a operação.

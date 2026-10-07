# Notas de implementação — src/middlewares

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `src/middlewares/authorization-middleware.ts`

**`export function authorize(...cargosPermitidos: Cargo[]) {`**

Middleware de autorização baseado em cargos (RBAC).

Deve ser usado APÓS o `authMiddleware`, que popula `req.user`.

@example
// Rota acessível apenas por ADMIN
router.delete("/conta/:id", authMiddleware, authorize(Cargo.ADMIN), deleteContaHandler);

@example
// Rota acessível por LOCADOR ou ADMIN
router.post("/veiculo", authMiddleware, authorize(Cargo.LOCADOR, Cargo.ADMIN), createVeiculoHandler);

@example
// Rota acessível por qualquer usuário autenticado
router.get("/perfil", authMiddleware, authorize(), getPerfilHandler);

**`export function authorizeOwner(paramName = "id") {`**

Middleware de autorização que garante que o usuário autenticado
só acessa/modifica seus próprios recursos (via parâmetro de rota).

Admins ignoram essa restrição e sempre passam.

@param paramName - Nome do parâmetro de rota com o ID do dono do recurso.
Padrão: "id"

@example
// LOCATARIO só acessa seus próprios dados; ADMIN acessa qualquer um
router.get("/locatario/:id", authMiddleware, authorizeOwner(), getLocatarioHandler);

@example
// Parâmetro customizado
router.put("/reserva/:reservaId/...", authMiddleware, authorizeOwner("reservaId"), ...);

## `src/middlewares/locale.ts`

**`export const localeMiddleware: RequestHandler = (req, _res, next) => {`**

Resolve o idioma da requisição a partir do header Accept-Language e o
disponibiliza em req.locale (padrão "pt"). Usado pelo error-handler e pelos
fluxos que produzem texto ao usuário (ex.: e-mails).

## `src/middlewares/observability.ts`

**`export function observability(`**

Observabilidade básica de requisições:
- request id: reutiliza o header X-Request-Id recebido (ex.: propagado por
um gateway/proxy) ou gera um UUID; anexa em req.id e devolve no header da
resposta para correlação ponta a ponta.
- tempo de execução: mede a duração da requisição com hrtime (monotônico).
- log estruturado: uma linha JSON por requisição concluída (silenciada em
teste pelo próprio logger).

## `src/middlewares/rate-limit.ts`

**`const isTestEnv = (): boolean => process.env.NODE_ENV === "test";`**

Rate limiting (hardening RNF05). Protege contra brute-force de autenticação
e abuso de rotas de escrita. Todos os limites são configuráveis por env
(ver config/env.ts) — configuração flexível, sem tocar no código.

Em ambiente de teste o limitador é desativado por padrão (skipInTest), pois a
suíte dispara muitas requisições pela mesma "origem". O teste dedicado do
rate limit constrói um limitador com skipInTest = false para exercitar o 429.

**`export const authLimiter = createRateLimiter({`**

Limitador estrito para autenticação (login/register): defesa contra
brute-force / credential stuffing.

**`export const webhookLimiter = createRateLimiter({`**

Webhooks recebem corpo cru antes do parser JSON global; por isso precisam de
um limitador próprio no ponto em que são montados.

**`const METODOS_ESCRITA = new Set(["POST", "PUT", "PATCH", "DELETE"]);`**

Aplica o writeLimiter apenas a métodos que mutam estado. Métodos de leitura
(GET/HEAD/OPTIONS) passam direto.

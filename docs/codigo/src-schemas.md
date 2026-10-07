# Notas de implementação — src/schemas

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `src/schemas/avaliacao-relatorio.schema.ts`

**`export const avaliacaoRelatorioQuerySchema = z`**

Query params do dashboard de avaliações (GET /api/avaliacao/relatorio).
Todos os filtros são opcionais; sem filtros, considera toda a base do
locador. granularidade e limiteComentarios têm default.

## `src/schemas/avaliacao.schema.ts`

**`nota: z`**

Escala 1..5. A model usa Decimal(2,1), portanto notas com uma casa
decimal (ex.: 4.5) são permitidas — comportamento preservado.

## `src/schemas/conta.schema.ts`

**`export const senhaForteSchema = z`**

Política de senha robusta: mín. 8 caracteres com minúscula, maiúscula,
número e caractere especial.

**`locatario: createLocatarioSchema.omit({ id: true }).optional(),`**

Task 10 (M-05): cadastro oficial em UMA operação. O perfil é opcional só
por compatibilidade com o fluxo legado em duas chamadas (testes/admin).

**`export const updateOwnContaSchema = z`**

Contrato exclusivo do titular: rejeita inclusive campos administrativos,
em vez de descartá-los silenciosamente.

## `src/schemas/locador-dashboard.schema.ts`

**`export const relatorioReservasQuerySchema = paginationQuerySchema`**

Filtros reais do relatório de reservas. Campos desconhecidos (inclusive
idLocador) são descartados: ownership vem sempre do JWT.

## `src/schemas/locador.schema.ts`

**`id: z.string().uuid("ID deve ser um UUID válido").optional(),`**

Para LOCADOR, o service substitui este campo pelo ID do JWT. Ele é
mantido opcional somente para a operação administrativa existente.

## `src/schemas/locatario.schema.ts`

**`const rgSchema = z`**

RG: normaliza (remove pontos/traços/espaços, uppercase) e valida o formato
geral — 6 a 14 caracteres terminando em dígito ou X (dígito verificador).
Não força máscara de UF específica, mas garante um documento plausível.

**`const dataNascimentoSchema = z.coerce`**

Data de nascimento: aceita ISO string/Date, exige data no passado e idade
entre 18 e 120 anos.

## `src/schemas/pagamento.schema.ts`

**`const cartaoSandboxSchema = z.object({`**

Dados de teste do cartão. Nada aqui é persistido: servem apenas para o
sandbox decidir o desfecho (ver src/infra/payment/sandbox.ts).

**`export const iniciarPagamentoSchema = z.object({`**

Corpo de POST /api/reserva/:id/pagamento.

Note o que NÃO existe aqui: nenhum campo de status, nenhum de valor. O
desfecho é decidido pelo backend e o valor vem da reserva.

## `src/schemas/reserva.schema.ts`

**`const DURACAO_MINIMA_MS = 60 * 60 * 1000;`**

RN05: duração da reserva. Mínimo 1 hora, máximo 30 dias (bordas inclusivas).
Espelha a checagem-fonte em ReservaService.assertPeriodoValido.

**`idGaragemRetirada: z.string().uuid().optional(),`**

Local de retirada (garagem atual do veículo) e local de devolução
(garagem do mesmo locador dono do veículo).

**`servicosIds: z.array(z.string().uuid()).optional(),`**

valorTotal NÃO é aceito do cliente. O backend calcula a partir da
valorDiaria do ModeloVeiculo × diárias + serviços opcionais.

**`metodoPagamento: z.nativeEnum(MetodoPagamento).optional(),`**

status e statusPagamento NÃO são aceitos do cliente. Toda reserva nasce
AGUARDANDO_PAGAMENTO (default do banco); o status só avança por ações de
domínio (/cancelar, /devolucao) e o statusPagamento só pelo webhook
assinado do gateway (POST /api/webhooks/pagamento/\*).
metodoPagamento é uma escolha do cliente (meio pretendido), não o
resultado, então permanece aceito.

**`metodoPagamento: z.nativeEnum(MetodoPagamento).optional(),`**

RN04: status e valorTotal NÃO são mais aceitos via PUT. Mutação livre de
status/valor era vulnerabilidade transversal (cancelar de graça, reescrever
preço). Cancelamento agora é ação de domínio: POST /:id/cancelar.
statusPagamento continua fora do cliente (só muda via webhook do gateway).

**`const coordenadaFields = {`**

Coordenada do dispositivo no momento do desbloqueio (RN03 — geofence).
Latitude/longitude são opcionais, mas ou ambas ou nenhuma.

**`export const desbloquearQrSchema = z`**

Body do desbloqueio via QR Code (POST /api/reserva/:id/desbloqueio/qr).
O QR carrega um token assinado que resolve para o mesmo código textual.

## `src/schemas/servico-opcional.schema.ts`

**`export const createServicoOpcionalSchema = z.object({`**

Catálogo é populado via seed; estes schemas validam entradas administrativas
e mantêm o padrão por-entidade do projeto.

## `src/schemas/veiculo.schema.ts`

**`garagemId: z.string().uuid().nullable().optional(),`**

Veículos em preparação podem ficar sem garagem, mas uma garagem
informada precisa passar pela regra de ownership/capacidade do domínio.

**`modelo: z`**

Os dados do catálogo são aninhados para deixar explícita a fronteira
entre a instância física e o ModeloVeiculo. Campos como `marca` no
nível raiz devem ser rejeitados, nunca descartados silenciosamente.

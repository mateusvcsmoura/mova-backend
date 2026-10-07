# Notas de implementação — Testes (test/)

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `test/auditoria/auditoria.test.ts`

**`` const auth = (token: string) => ({ Authorization: `Bearer ${token}` }); ``**

RN09 — trilha de auditoria persistente das alterações de Locadores em
veículos e reservas.

## `test/avaliacao/avaliacao-relatorio.test.ts`

**`async function seedAvaliacao(`**

Semeia uma Reserva REALIZADA + Avaliacao diretamente via Prisma. O módulo de
relatório é de leitura e percorre Avaliacao -> Reserva -> Veiculo -> Locador;
semear direto dá controle total sobre nota/data/veículo sem esbarrar nas
regras de período/overlap da criação de reservas.

**`const DATA_ABR = new Date("2026-04-10T12:00:00.000Z");`**

Datas fixas para tornar os buckets de evolução e os filtros de período
determinísticos (meia-noite p/ evitar viés de fuso na borda dos meses).

**`}, 30000);`**

Setup pesado (2 registros de locador + locatário + 3 veículos + 4 seeds,
com bcrypt): folga além do hookTimeout padrão (10s) para não flakar em
execução fria/máquina lenta.

## `test/avaliacao/avaliacao.test.ts`

**`async function criarReservaRealizada(): Promise<any> {`**

Cada reserva REALIZADA usa um veículo próprio (o período fixo do helper
colidiria se reutilizasse o mesmo veículo).

## `test/bloqueio/bloqueio.test.ts`

**`});`**

NOTA (RN04): a confirmação via PUT {status:"CONFIRMADA"} foi removida — o
PUT não altera mais status. O bloqueio na confirmação passou a ser coberto
pela trilha do webhook de pagamento (RN07), testado no describe abaixo.

**`describe("Bloqueio de locatário — RN07 no webhook de pagamento", () => {`**

RN07: o webhook de pagamento é a única trilha que gera o código de
desbloqueio no SUCESSO. Bloqueio ativo detectado depois da criação não pode
ser contornado por essa trilha.

**`expect(res.status).toBe(200);`**

Webhook assinado recebe 200 para evitar reentregas; o bloqueio impede
confirmação e é tratado pela trilha idempotente de estorno sandbox.

## `test/cobranca/cobranca.test.ts`

**`await prisma.cobrancaReserva.updateMany({`**

Cada caso cria cobranças próprias; quitá-las ao final evita que RN07
contamine o próximo caso sem resetar o banco inteiro no meio do arquivo.

**`const reserva1 = await reservaBase();`**

Cria as duas reservas antes das cobranças: depois da primeira pendência
RN07 já impede a criação de nova reserva para o mesmo locatário.

## `test/concurrency/scheduler-exclusivo.test.ts`

**`describe("Execução única do scheduler (advisory lock)", () => {`**

Execução única entre múltiplas instâncias: o advisory lock do PostgreSQL
(pg_try_advisory_xact_lock) garante que, quando dois ticks disparam ao mesmo
tempo, só um roda o trabalho — o outro pula. Simulamos "duas instâncias" com
ticks concorrentes no mesmo processo: cada runExclusive abre uma transação
interativa, fixando conexões distintas do pool = sessões distintas.

**`beforeAll(async () => {`**

Aquece o pool: força a criação de conexões concorrentes de antemão. Sem
isso, o primeiro par de transações pode serializar numa única conexão
(setup lazy), liberando o lock entre elas e mascarando a exclusão mútua.

**`executar: async () => {`**

Ao entrar, sinaliza e segura o lock até liberarmos — garante que o
segundo tick tente o lock com o primeiro ainda dentro.

## `test/conta/cadastro-atomico.test.ts`

**`const registrar = (body: Record<string, unknown>) =>`**

Task 10 — M-05 (D10-07/D10-08): Conta + perfil nascem numa única transação.
Qualquer falha desfaz tudo: nenhuma Conta órfã, nenhum perfil sem Conta.

## `test/contrato/contrato-api.test.ts`

**`describe("Contrato da API", () => {`**

Contrato frontend &lt;-> backend (TASK 01).
Ver auditoria/CONTRATO-FRONTEND-BACKEND.md.

## `test/dashboard/locador-dashboard.test.ts`

**`async function seedReserva(`**

Seed direto de reserva (bypassa regras de negócio de criação — foco é o
relatório). Duração de 24h por padrão.

## `test/e2e/jornada-reserva-pagamento.test.ts`

**`const VALOR_DIARIA = 180.5;`**

TASK 04 — jornada completa, na ordem em que o usuário a percorre:
login -> veículo -> garagem -> data/hora -> reserva -> pagamento sandbox ->
webhook assinado -> reserva confirmada + código de desbloqueio.

Cada passo usa a API real; nada é escrito direto no banco para "ajudar" o
fluxo. Ver auditoria/PAGAMENTO.md.

**`const pagamento = await request(app)`**

8. Pagamento em sandbox — só o método e os dados de teste. O desfecho é
do backend; o webhook assinado do gateway simulado é quem confirma.

**`const codigo: string = consulta.body.result.codigoDesbloqueio;`**

9. Desbloqueio (TASK 05). O cliente recupera o código pela própria API —
nada de estado local — e só então desbloqueia. Antes disso, a janela de
uso é aberta (arranjo de cenário: a retirada seria daqui a alguns dias).

**`const repetido = await request(app)`**

10. Uso único: repetir o mesmo código não reabre o veículo, e a consulta
seguinte (fonte de verdade da tela) segue EM_ANDAMENTO.

## `test/favorito/favorito.test.ts`

**`const response = await request(app)`**

outroLocatario não favoritou este veículo — 404, e o favorito
do dono permanece intacto.

**`it("veículo soft-deleted sai da lista de favoritos, mas a linha é preservada", async ()...`**

RN08: a exclusão de veículo virou soft delete (INATIVO). A linha de
favorito é preservada (sem cascade destrutivo), mas o veículo removido
do catálogo não aparece mais na lista de favoritos do locatário.

## `test/garagem/corrida-movimentacao-indisponibilizacao.test.ts`

**`` const auth = (token: string) => ({ Authorization: `Bearer ${token}` }); ``**

Task 11 (T11-P2-003): movimentação de veículo × indisponibilização da garagem
de origem. Ordem global de locks: reserva → veículo → garagens (linha) →
linhas de reserva. A movimentação travava as linhas de reserva ANTES das
garagens, em ciclo com a alteração de garagem (garagem → reservas): o
PostgreSQL abortava uma das transações (40P01) e a API respondia 404/500.

**`const reserva = await createReserva(locatario.token, veiculo.id, locatario.locatarioId,...`**

Reserva não paga, dentro do prazo: fixa a garagem (B9) mas não impede a
manutenção da garagem (só reserva paga protege — Task 10.1).

**`expect(mover.status).toBe(409);`**

A reserva pendente fixa a garagem de retirada: mover é sempre recusado
pela regra de negócio, nunca por falha técnica.

## `test/garagem/garagem-jornada-reserva.test.ts`

**`describe("Garagens na jornada de reserva", () => {`**

TASK 02 — garagens reais na jornada de reserva.
Cobre o que o frontend precisa para escolher retirada/devolução:
listagem filtrada pelo locador dono do veículo e as pré-condições de criação.
Ver auditoria/GARAGENS.md.

## `test/garagem/reserva-futura-protegida.test.ts`

**`const CODIGO = "GARAGEM_COM_RESERVA_FUTURA_CONFIRMADA";`**

Task 10.1 — Bug B (D10.1-07/08): garagem ainda necessária a uma reserva
confirmada (retirada ainda não feita, ou devolução ainda pendente) não vai
para MANUTENCAO/INATIVA. Nada é cancelado nem remanejado.

## `test/helpers.ts`

**`let counter = 0;`**

Contador global de processo — gera valores únicos entre chamadas.
O banco é limpo por arquivo (setup.ts), então não há colisão de constraints.

**`function cpfComDv(base9: string): string {`**

Geradores de documentos com dígitos verificadores VÁLIDOS (as validações
reais rejeitam checksum inválido). Base sequencial garante unicidade.

**`export const uniqueCnh = () => {`**

Alguns bases produzem DV = 10 (CNH inexistente, 12 dígitos) — pula até obter
uma CNH de 11 dígitos que passe na validação real (evita 400 esporádico).

**`export async function createAccount(`**

Registra uma conta e faz login. Retorna o token de LOGIN, que contém o
cargo no payload do JWT (necessário para o authMiddleware aceitar a rota).

**`export async function createAdminAccount(`**

Provisionamento de teste: ADMIN nunca passa pela rota pública. O token vem
do login real para manter JWT e middleware sob teste.

**`export const VALOR_DIARIA_PADRAO = 125.25;`**

Diaria padrao dos veiculos de teste. 125,25/dia x 2 diarias (futurePeriod
padrao) = 250,50 — mesmo valor que os testes usavam quando o cliente ainda
enviava valorTotal. O backend e a fonte de verdade do preco (TASK 04), entao
os testes derivam o esperado daqui em vez de cravar um numero.

**`export async function createVeiculo(`**

Cria um veículo. Exige token LOCADOR (dono) ou ADMIN — a rota de criação
agora é protegida e o ownership é validado no service.

**`export async function createServico(`**

Cria um serviço opcional no catálogo. Inserido direto via Prisma porque o
catálogo é populado por seed (não há endpoint público de criação).

**`async function ensureOperationalGarageForReservation(idVeiculo: string) {`**

A partir do H-04, uma nova reserva exige ponto operacional de retirada.
Muitos testes de domínios não relacionados criam apenas o veículo porque,
antes dessa regra, a garagem era opcional para o cenário. Provisionamos uma
garagem de fixture somente quando o teste não escolheu explicitamente um
ponto de retirada; os testes adversariais de veículo sem garagem continuam
chamando a API diretamente e, portanto, preservam a cobertura da rejeição.

**`const { status, ...resto } = overrides as { status?: StatusReserva };`**

status NÃO é mais aceito pela API (é do domínio). Os testes que precisam de
uma reserva em outro estado continuam pedindo via override, mas o valor é
aplicado direto no banco, depois da criação — arranjo de cenário, não um
buraco no contrato.

**`if (!Object.prototype.hasOwnProperty.call(resto, "idGaragemRetirada")) {`**

valorTotal NÃO é mais enviado: o backend calcula a partir da valorDiaria
do modelo do veículo.

**`const WEBHOOK_HEADER: Record<string, string> = {`**

Confirma o pagamento de uma reserva via webhook ASSINADO do gateway — o
único caminho que altera statusPagamento agora (o cliente não pode mais setar
via PUT). Assina o corpo cru com o mesmo HMAC-SHA256 que o gateway valida.

## `test/i18n/mensagens-catalogo.test.ts`

**`const DINAMICAS_NAO_TRADUZIDAS = [`**

Mensagens dinâmicas (template literal com variável) não entram no catálogo
por texto exato; seguem em pt. Nova entrada aqui = decisão consciente.

## `test/interesse/interesse-rn11.test.ts`

**`expect(afterCycle.body.result).toHaveLength(1);`**

A inscrição é consumida após o primeiro aviso; novo ciclo exige novo
opt-in, evitando spam em transições repetidas.

## `test/interesse/interesse-veiculo.test.ts`

**`const LOCATARIO_A = "aaaaaaaa-1111-1111-1111-111111111111";`**

Fakes compartilhados

**`function makePrefChecker(desabilitados: string[] = []) {`**

Checker de preferência: qualquer idConta em `desabilitados` está opt-out
(retorna false); os demais habilitados (opt-in padrão).

**`describe("InteresseVeiculoService", () => {`**

InteresseVeiculoService — registro, duplicidade, cancelamento, isolamento

**`describe("NotificacaoVeiculoDisponivelService", () => {`**

NotificacaoVeiculoDisponivelService — disparo, persistência, falhas

**`describe("VeiculoService — disparo automático ao voltar a DISPONIVEL", () => {`**

VeiculoService — disparo automático na transição de status

## `test/monitoramento/monitoramento-veiculo.test.ts`

**`vi.mock("../../src/shared/advisory-lock", () => ({`**

O scheduler agora roda o tick sob advisory lock (runExclusive). Aqui, os
testes de mecânica do timer usam fake timers e um service fake — o lock real
(que fala com o banco) não pode entrar no caminho do timer, então stubamos
runExclusive para apenas invocar a função. A execução única sob lock real é
coberta em test/concurrency/scheduler-exclusivo.test.ts.

**`const UM_DIA_MS = 24 * 60 * 60 * 1000;`**

Fakes compartilhados

**`function makeMonitoramentoRepo(dados?: {`**

Repositório de monitoramento em memória. As consultas de candidatos aplicam
os MESMOS critérios das queries reais (data-limite / HAVING), para que os
testes exerçam os thresholds passados pelo service.

**`describe("MonitoramentoVeiculoService — inatividade", () => {`**

Regra 1 — veículo inativo

**`describe("MonitoramentoVeiculoService — baixa avaliação", () => {`**

Regra 2 — baixa avaliação recorrente

**`describe("MonitoramentoVeiculoService — dedup, falha e resolução", () => {`**

Deduplicação, falha de envio e resolução

**`inativos.push(makeInativoRow());`**

Reincidência: volta a ficar inativo -> novo alerta (o anterior está
resolvido, então não bloqueia).

**`describe("MonitoramentoScheduler", () => {`**

Rotina periódica (scheduler)

**`describe("VeiculoService — histórico de status (regressão)", () => {`**

Regressão — VeiculoService continua funcionando com/sem recorder

## `test/notificacao/notificacao-reserva.test.ts`

**`function makeReserva(overrides: Partial<ReservaResponse> = {}): ReservaResponse {`**

Fakes compartilhados

**`describe("NodemailerMailProvider", () => {`**

NodemailerMailProvider (mock do nodemailer)

**`describe("NotificacaoReservaService", () => {`**

NotificacaoReservaService (orquestração + tratamento de erro)

**`describe("ReservaService.confirmarPagamento — regressão de e-mail", () => {`**

Regressão: a reserva continua funcionando quando o e-mail falha

**`gerarCodigoDesbloqueio: vi.fn(async (_id: string, codigo: string) => ({ ...confirmada, ...`**

Fake fiel ao repositório: devolve a reserva com o código gravado pela
própria chamada (o service só notifica a entrega que gravou o código).

## `test/notificacao/real-email.test.ts`

**`import { NodemailerMailProvider } from "../../src/infra/email/nodemailer.provider";`**

ATENÇÃO: este arquivo NÃO mocka o Nodemailer — ele envia um e-mail REAL.
Por isso é opt-in: só roda quando RUN_REAL_EMAIL_TEST=true E o SMTP está
configurado. Em `npm test` normal (sem essas variáveis) todos os casos são
pulados, então a suíte jamais envia e-mail sozinha.

Como rodar (PowerShell), com App Password do Gmail no .env:
$env:RUN_REAL_EMAIL_TEST="true"; npx vitest run test/notificacao/real-email

Ou passando tudo inline:
$env:RUN_REAL_EMAIL_TEST="true"; $env:SMTP_HOST="smtp.gmail.com"; `
$env:SMTP_PORT="465"; $env:SMTP_USER="voce@gmail.com"; `
$env:SMTP_PASS="app-password"; $env:SMTP_FROM="Mova &lt;voce@gmail.com>"; `

`npx vitest run test/notificacao/real-email`

## `test/notificacao/reserva-report.test.ts`

**`it("formata data/hora no fuso de negócio, não no fuso do servidor", async () => {`**

TASK 03: o formatador precisa fixar o fuso de negócio. Sem isso ele usaria
o fuso do PROCESSO, e o mesmo instante sairia com horas diferentes em
máquinas diferentes (dev em America/Sao_Paulo vs. CI em UTC).
O fixture usa 2026-08-01T10:00:00.000Z, que é 07:00 em São Paulo.

**`const tzOriginal = process.env.TZ;`**

Força o processo para UTC: é o cenário do CI (GitHub Actions). Sem o timeZone fixo no
template, o horário sairia 10:00 (o próprio UTC) em vez de 07:00.

**`expect(count(renderReservaReport(comServicos).html, "Serviços adicionais")).toBe(`**

"Serviços adicionais" aparece no resumo financeiro sempre; a SEÇÃO de
serviços (mesmo rótulo) só quando há itens -> 1 ocorrência a menos.

## `test/pagamento/pagamento-sandbox.test.ts`

**`const CARTAO_APROVADO = "4111111111111234";`**

TASK 04 — fluxo de pagamento em sandbox.

O desenho sob teste: o cliente NUNCA declara o resultado. Ele envia dados de
teste; o backend decide o desfecho, registra a cobrança, deixa PROCESSANDO e
entrega o evento ao simulador de gateway, que assina um webhook e o devolve
pelo mesmo caminho de um gateway real (verificação de assinatura inclusa).

Ver auditoria/PAGAMENTO.md.

**`let deslocamento = 40;`**

Cada reserva usa um veículo próprio para não colidir períodos.
futurePeriod(_, 2) = 2 diárias.

**`expect((await confirmarPagamentoWebhook(reserva.id)).status).toBe(200);`**

A pendência é intencional neste cenário; quitá-la evita contaminar as
reservas independentes criadas pelos próximos exemplos.

**`const multa = await prisma.cobrancaReserva.findFirstOrThrow({`**

A multa já foi retida do valor pago: não pode virar uma segunda cobrança
pendente (que bloquearia o locatário pela RN07).

## `test/pagamento/retentativa-pos-recusa.test.ts`

**`` const auth = (token: string) => ({ Authorization: `Bearer ${token}` }); ``**

Task 11 (T11-P2-001/002): uma tentativa de pagamento recusada pelo webhook
(RN07 ou veículo/garagem indisponível) não pode tornar a reserva impagável.
A nova tentativa, dentro do prazo e com a causa resolvida, precisa confirmar.

## `test/pagamento/webhook.test.ts`

**`describe("Webhook de pagamento (assinado)", () => {`**

Webhook assinado do gateway de pagamento: é o ÚNICO caminho que confirma
pagamento. Cobre assinatura válida/ inválida, provider desconhecido e o fato
de o cliente não poder mais setar statusPagamento direto.

## `test/re-review/blocker-c01-c02.test.ts`

**`const basePayload = () => ({`**

Re-review independente dos blockers FINAL-C-01 (registro público cria ADMIN)
e FINAL-C-02 (self-update eleva cargo). Nada aqui confia nos relatórios das
tasks anteriores: cada ataque é reproduzido pela API real e o efeito é
verificado diretamente no banco.

## `test/re-review/blocker-h01.test.ts`

**`const CARTAO_OK = {`**

FINAL-H-01 — integridade financeira do período da reserva.
Ataques independentes: nenhuma asserção deriva dos relatórios das tasks.

## `test/re-review/blocker-h02.test.ts`

**`let locadorA: LocadorContext;`**

FINAL-H-02 — IDOR em GET /api/reserva/veiculo/:id_veiculo e exposição do
codigoDesbloqueio em respostas de gestão. Fixtures montados aqui, do zero.

**`for (const reserva of [reservaA, reservaB]) {`**

Pagamento aprovado gera o código de desbloqueio REAL no banco: sem isso a
verificação de exposição seria um falso negativo.

## `test/re-review/blocker-h03.test.ts`

**`async function estadoVeiculo(id: string) {`**

FINAL-H-03 — contrato de edição Veiculo x ModeloVeiculo. O contrato é
derivado do código atual (updateVeiculoSchema: placa/status/garagemId no
nível raiz + bloco aninhado `modelo`), não copiado do relatório da Task 04.

## `test/re-review/blocker-h04.test.ts`

**`const garagemDb = (id: string) =>`**

FINAL-H-04 — cadeia garagem → veículo → catálogo → reserva.
Todos os ataques passam pela API real; o estado é conferido no banco.

## `test/reserva/cancelamento-locador.test.ts`

**`function janelaTardia() {`**

Task 10 — BUG-02 (D10-01): a multa de 20 % da RN04 é só do cancelamento
tardio iniciado pelo LOCATÁRIO. Cancelamento operacional (LOCADOR, ou ADMIN
em nome da operação) nunca multa o locatário e, se pago, estorna 100 %.

**`async function reservaPagaTardia() {`**

Pagamento confirmado pelo fluxo oficial (sandbox PIX); o período tardio é
aplicado depois, porque o pagamento não depende do horário de início.

## `test/reserva/cancelamento.test.ts`

**`async function novaReserva(`**

Cada reserva usa um veículo próprio para não colidir períodos.
O valor da reserva e calculado pelo backend (TASK 04) a partir da diaria do
modelo; por isso o teste controla valorDiaria, nao valorTotal. A diaria mora
no ModeloVeiculo, reaproveitado pelo unique [idLocador, marca, modelo, ano],
entao o modelo tambem varia.

## `test/reserva/datas-horarios.test.ts`

**`describe("Datas e horários da reserva", () => {`**

TASK 03 — representação de data/hora ponta a ponta.
As regras RN05 permanecem intactas; aqui se verifica que o INSTANTE é o mesmo
em todo o caminho e que as bordas respondem como documentado.
Ver auditoria/DATAS-HORARIOS.md.

**`const base = new Date(Date.now() + 10 * DIA);`**

1 hora exata cruzando a meia-noite. Se em algum ponto houvesse
truncamento por "dia" em vez de instante, este caso quebraria.

**`const comOffset = "2027-06-10T10:00:00-03:00";`**

O mesmo momento escrito de duas formas: z.coerce.date() precisa tratar
as duas como idênticas, e a API responde sempre normalizada em UTC.

## `test/reserva/expiracao-pagamento.test.ts`

**`const MIN = 60 * 1000;`**

Task 10 — BUG-05 (D10-03/D10-04), BUG-03/M-02 (D10-02) e D10-05.
O tempo é controlado pela data de criação gravada no banco (fixture), não
por espera real: nenhum teste aguarda 15 minutos.

## `test/reserva/pagamento-veiculo-indisponivel.test.ts`

**`const CODIGO = "VEICULO_INDISPONIVEL_PARA_CONFIRMAR_RESERVA";`**

Task 10.1 — Bug A (D10.1-01..06): reserva não paga não protege o veículo,
mas um veículo (ou garagem) indisponível não pode ter o pagamento
confirmado. Invariável: nunca "pago/confirmado" + veículo indisponível.

**`expect([409, 202]).toContain(pagamento.status);`**

Manutenção antes do início → 409; entre o início e o webhook →
tentativa não aprovada (o valor do sandbox é estornado).

## `test/reserva/reserva-concorrente.test.ts`

**`describe("Reserva concorrente (race de double-booking)", () => {`**

Race de double-booking: duas requisições concorrentes reservando o MESMO
veículo no MESMO período. A checagem otimista de overlap passa nas duas antes
de qualquer insert; sem o advisory lock por veículo na transação de create,
ambas gravariam. Com o lock, exatamente uma vence (201) e a outra recebe 409.

## `test/reserva/reserva.test.ts`

**`it("recusa PUT que só tenta alterar status (campo removido — RN04)", async () => {`**

RN04: status e valorTotal saíram do schema do PUT. Enviar só esses
campos = nenhum campo válido -> 400.

**`it("bloqueia veículo categoria=PCD (adaptado=false) para locatário sem deficiência", as...`**

RN01: o marcador categoria=PCD também exige deficiência, mesmo com
adaptado=false (fechava a brecha de under-enforcement).

**`const periodo = (startInDays: number, duracaoMs: number) => {`**

Período com controle de milissegundos (futurePeriod só dá granularidade de
dias). startInDays evita sobreposição entre os cenários no mesmo veículo.

**`const DIARIAS = 3;`**

Reserva confirmada e desbloqueada (código usado). Janela aberta no desbloqueio;
depois os testes ajustam dataHoraFim/Inicio para simular prazo/atraso.
O valor da reserva e calculado pelo backend (TASK 04): o teste controla a
diaria do veiculo, nao o total. futurePeriod(1, 3) -> 3 diarias.

**`const veiculo = await createVeiculo(locador.token, locador.locadorId, {`**

valorDiaria mora no ModeloVeiculo, que e reaproveitado pelo unique
[idLocador, marca, modelo, ano] sem sobrescrever o preco. Para variar a
diaria e preciso variar o modelo.

**`const fim = new Date(Date.now() - 60 * 60 * 1000);`**

fim há 1h (atraso &lt; 1 dia -> 1 diária); duração exata de 1 dia, logo a
diária proporcional = valorTotal (300). 1 diária + 10% = 330. inicio
ancorado em fim p/ evitar drift de ms.

**`const fim = new Date(Date.now() - 5 * 60 * 1000);`**

fim há 5 min -> ainda 1 diária de atraso; duração 1 dia, logo a diária
proporcional = valorTotal (600). 1 diária + 10% = 660.

**`describe("Reserva — desbloqueio: efeito e recusas (TASK 05)", () => {`**

TASK 05 — desbloqueio ponta a ponta: transição para EM_ANDAMENTO e os casos
de recusa que a tela precisa distinguir. Ver auditoria/DESBLOQUEIO.md.

## `test/security/jwt.test.ts`

**`describe("Autenticação JWT", () => {`**

Garante que o authMiddleware verifica o token contra env.JWT_SECRET (segredo
validado no boot) — e não contra um process.env não validado.

## `test/security/rate-limit.test.ts`

**`describe("Rate limiting", () => {`**

O rate limiter é desativado no ambiente de teste (skipInTest) para não
estrangular a suíte. Aqui construímos um limitador com skipInTest = false
e limite baixo, montado num app descartável, para exercitar o retorno 429.

## `test/security/register-token.test.ts`

**`describe("Token do register", () => {`**

O token emitido no cadastro deve ter o MESMO payload do login (id + cargo),
para que o authMiddleware — que exige cargo — o aceite.

## `test/setup.ts`

**`async function assertAmbienteDeTeste() {`**

Trava de segurança: a suíte TRUNCA todas as tabelas. Só pode rodar quando o
processo está explicitamente em modo de teste, porque é NODE_ENV=test que faz
src/database/prisma.ts escolher DATABASE_URL_TEST. Sem esta checagem, rodar o
arquivo por outro caminho (script, tsx, dev server) apagaria o banco de
desenvolvimento/produção silenciosamente.

**`async function resetDatabase() {`**

Limpa todas as tabelas respeitando as foreign keys do schema.prisma.
Roda uma vez antes de cada arquivo de teste, garantindo isolamento.

## `test/veiculo/reserva-futura-protegida.test.ts`

**`const CODIGO = "VEICULO_COM_RESERVA_FUTURA_CONFIRMADA";`**

Task 10 — B-03/BUG-14 (D10-06): veículo com compromisso válido (reserva
paga futura ou em andamento) não pode ir para MANUTENCAO/INATIVO. Nada é
cancelado nem remanejado: o locador resolve a reserva primeiro.

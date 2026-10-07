# Notas de implementação — src/services

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `src/services/auditoria.ts`

**`export class AuditoriaService {`**

RN09 — consulta SOMENTE LEITURA da trilha de auditoria. Não existe caminho de
edição/exclusão na aplicação (e o banco recusa UPDATE/DELETE por gatilho).

## `src/services/avaliacao-relatorio.ts`

**`gerarDashboard = async (`**

Gera o dashboard completo do locador autenticado. O idLocador vem sempre do
token (parâmetro), nunca do cliente — isolamento garantido em todas as
consultas. Sem avaliações, retorna zeros/listas vazias (não é erro).

**`const [resumo, distribuicao, agregadoVeiculo, evolucao, comentariosRecentes] =`**

Consultas independentes rodam em paralelo (mesma pool). Cada uma agrega no
banco; nenhuma carrega o conjunto bruto de avaliações em memória.

## `src/services/bloqueio.ts`

**`const MENSAGEM_POR_MOTIVO: Record<MotivoBloqueio, string> = {`**

Mensagens de negócio por motivo. Centralizadas para manter o erro consistente
e permitir novos motivos sem espalhar strings pelo código.

**`assertLocatarioLiberado = async (idLocatario: string): Promise<void> => {`**

Regra central reutilizada na criação/confirmação de reservas. Lança 403
quando há um bloqueio impeditivo, com a mensagem correspondente ao motivo.
Consulta única e otimizada (findFirst), sem carregar o histórico.

## `src/services/cobranca.ts`

**`const expirarProcessando = (where: Prisma.CobrancaReservaWhereInput) =>`**

Task 10 (D10-02): tentativa PROCESSANDO há 15 min ou mais vira FALHA (não
quitada), liberando nova tentativa. atualizadoEm marca a entrada em
PROCESSANDO: nenhuma outra escrita toca a cobrança enquanto ela processa.

## `src/services/conta.ts`

**`private gerarToken(payload: { id: string; cargo: string }): string {`**

Gera o token JWT usando o segredo/expiração já validados em config/env.ts.
Payload único (id + cargo) compartilhado por register e login, para que o
authMiddleware — que exige `cargo` — aceite ambos os tokens.

**`async register({ locatario, locador, ...data }: CreateContaRequest & PerfilCadastro) {`**

Task 10 (M-05): cadastro oficial = Conta + perfil numa operação atômica
(o repositório usa uma única transação). As checagens abaixo só dão
mensagens claras; a garantia de integridade é a transação/constraint.

**`const token = this.gerarToken({ id: conta.id, cargo: conta.cargo });`**

Mesmo payload do login (id + cargo) para que o authMiddleware aceite o
token emitido no cadastro.

**`if (data.email && data.email !== existingConta.email) {`**

Unicidade de e-mail no update: rejeita se o novo e-mail já pertence a
outra conta (o create já valida; aqui fecha a lacuna apontada na auditoria).

## `src/services/contracts/alerta-veiculo.ts`

**`export interface AlertaVeiculoInfo {`**

Payloads dos alertas de monitoramento. Estruturas intermediárias,
independentes do canal de saída e das entidades do Prisma: o serviço de
monitoramento as monta; os templates de cada canal apenas as consomem.

## `src/services/contracts/reserva-report.ts`

**`export interface ReservaReportPayload {`**

Payload do relatório de reserva. É a estrutura intermediária, independente do
formato de saída (HTML/texto/futuro PDF) e das entidades do Prisma. O builder
monta este payload; os templates apenas o consomem.

## `src/services/contracts/veiculo-disponivel.ts`

**`export interface VeiculoDisponivelPayload {`**

Payload da notificação de veículo disponível. Estrutura intermediária,
independente do canal de saída (e-mail hoje; push/SMS/WhatsApp no futuro) e
das entidades do Prisma. O dispatcher monta este payload; os templates de
cada canal apenas o consomem.

## `src/services/favorito.ts`

**`export class FavoritoService {`**

Isolamento por usuário: todos os métodos recebem o id do locatário extraído
do token (req.user.id) — nunca do body/params. Um locatário só enxerga e
modifica os próprios favoritos.

**`private async assertLocatarioExiste(idLocatario: string): Promise<void> {`**

Conta LOCATARIO pode existir sem o registro de Locatario (cadastro em duas
etapas) — o favorito exige o registro por causa da FK.

**`private async assertVeiculoExiste(idVeiculo: string): Promise<void> {`**

Task 11: mesmo critério do catálogo público (DISPONIVEL em garagem ATIVA).
Favoritar um veículo fora do catálogo devolvia placa, status e dados do
locador de um veículo que o público não deveria enxergar.

## `src/services/garagem.ts`

**`if (requester.cargo === Cargo.LOCATARIO) {`**

O locatário precisa consultar garagens para escolher retirada/devolução
na reserva. Só enxerga as ATIVAS, e apenas em leitura — toda escrita
continua restrita ao locador dono (assertLocadorResponsavel).

**`private assertPodeGerenciar(`**

Task 11: escrita (editar/excluir) = dono LOCADOR ou ADMIN. assertGaragemAccess
admite LOCATARIO em garagem ATIVA (leitura) e não serve para escrita.

**`if (requester.cargo === Cargo.LOCATARIO) {`**

Locatário: catálogo público de garagens, restrito às ATIVAS. O filtro é
forçado aqui (não aceita override pela query) para não vazar garagens
inativas ou em manutenção.

## `src/services/interesse-veiculo.ts`

**`export class InteresseVeiculoService {`**

Watchlist de disponibilidade: regra de negócio das inscrições de interesse.

Isolamento por usuário: todos os métodos recebem o id do locatário extraído
do token (req.user.id) — nunca do body/params. Um locatário só enxerga e
modifica as próprias inscrições.

**`private async assertLocatarioExiste(idLocatario: string): Promise<void> {`**

Conta LOCATARIO pode existir sem o registro de Locatario (cadastro em duas
etapas) — a inscrição exige o registro por causa da FK.

**`registrar = async (`**

Registro de interesse (opt-in). O par (locatário, veículo) é único no
banco: se já houve inscrição encerrada (cancelada/notificada), a mesma
linha é reativada com o consentimento renovado.

## `src/services/lgpd.ts`

**`export class LgpdService {`**

Direitos LGPD do titular: portabilidade (exportação), anonimização (direito
ao esquecimento) e transparência (trilha de auditoria de acesso).

Não remove funcionalidades: a anonimização preserva as linhas e o histórico
de negócio, apagando apenas o PII.

## `src/services/locador-dashboard.ts`

**`export class LocadorDashboardService {`**

Dashboard do locador (RF17/RF18). Serviço fino: a autorização (LOCADOR) é
feita na rota e o idLocador vem sempre do token, garantindo que o locador
só enxerga dados dos próprios veículos.

## `src/services/localizacao-simulador.ts`

**`export class LocalizacaoSimulador {`**

Simulador de rastreador GPS.

NÃO integra hardware nem libs externas: a cada `intervaloMs` gera uma nova
posição (com pequeno drift sobre a última conhecida) para cada veículo ativo
e persiste via `LocalizacaoService.registrar`, reutilizando toda a validação
e o histórico já existentes.

Roda inteiramente no servidor (sem HTTP/auth): é código confiável, então não
passa pela camada de autenticação — o endpoint HTTP continua disponível para
dispositivos reais no futuro.

**`private async listarTodosVeiculos(): Promise<VeiculoResponse[]> {`**

Executa uma rodada de atualização. Público para ser testável sem timer.
Retorna quantos veículos foram atualizados.

Percorre todas as páginas para obter a frota completa: o repositório agora é
paginado, mas o simulador precisa avaliar todos os veículos a cada tick.

**`async tick(): Promise<number> {`**

Sob advisory lock: com múltiplas instâncias, só uma roda o tick por vez —
as demais pulam (evita posições duplicadas). Retorna quantos veículos foram
atualizados, ou 0 se o tick foi pulado por outra instância estar rodando.

## `src/services/localizacao.ts`

**`private async getVeiculoOrThrow(idVeiculo: string): Promise<VeiculoResponse> {`**

Carrega o veículo (404 se não existir) para consultas que precisam do
idLocador na verificação de acesso.

**`private async assertPodeConsultar(`**

Autoriza a consulta de localização:
ADMIN     -> qualquer veículo;
LOCADOR   -> apenas os próprios veículos;
LOCATARIO -> apenas veículos de reservas às quais pertence.

**`private assertCoordenadasValidas(latitude: number, longitude: number): void {`**

Valida o intervalo das coordenadas (defesa em profundidade — o schema Zod
já valida na borda, mas a regra de negócio também é garantida aqui).

**`findUltimaDaReserva = async (`**

RF14: o Locatário nunca consulta um veículo diretamente. A reserva do
próprio token define veículo, estado e janela temporal permitidos.

## `src/services/monitoramento-scheduler.ts`

**`intervaloMs: number;`**

Período entre execuções da rotina (ms). Alterável via env
MONITORAMENTO_INTERVALO_MS sem tocar no código.

**`intervaloMs: 60 * 60 * 1000,`**

1x por hora por padrão: as regras têm granularidade de dias, então uma
frequência maior só gastaria consultas sem mudar o resultado.

**`export class MonitoramentoScheduler {`**

Rotina periódica de monitoramento da frota (mesma estratégia do
LocalizacaoSimulador: setInterval iniciado opcionalmente no boot — ver
src/server.ts). Sem dependências novas de cron: o intervalo cobre a
necessidade e é configurável por env.

Roda inteiramente no servidor (sem HTTP/auth). O MonitoramentoVeiculoService
nunca lança, mas o tick ainda captura qualquer erro para o timer jamais
derrubar o processo.

**`async tick(): Promise<boolean> {`**

Executa uma rodada. Público para ser testável e acionável sem timer
(endpoint administrativo usa o service diretamente).

Sob advisory lock: com múltiplas instâncias, só uma roda o tick por vez —
as demais pulam (evita alertas/e-mails duplicados). Retorna se executou.

## `src/services/monitoramento-veiculo.ts`

**`const MAX_TENTATIVAS_ALERTA = 5;`**

Teto de tentativas de envio de um alerta. Ao atingir, a rotina para de
reenviar (dead-letter) — evita marteladas em SMTP indisponível.
ponytail: fixo; virar config se o cenário exigir backoff/reset.

**`minAvaliacoes: number;`**

Mínimo de avaliações na janela para a regra de média (evita alerta por
uma única avaliação isolada).

**`export interface ResultadoRegra {`**

Resultado de uma regra em uma execução — retornado pelo endpoint manual e
logado pela rotina periódica.

**`interface CandidatoAlerta {`**

Candidato normalizado: qualquer regra produz esta estrutura, e o
processamento (dedup -> registro -> envio -> resolução) é único. Novas
regras = um método que gera candidatos + um TipoAlertaVeiculo novo.

**`export class MonitoramentoVeiculoService {`**

Serviço de monitoramento da frota: aplica as regras, gera/deduplica os
alertas e delega o envio ao dispatcher. NUNCA lança — é executado por rotina
periódica e a falha de uma regra não pode derrubar a outra nem o scheduler.

**`private async candidatosInatividade(agora: Date): Promise<CandidatoAlerta[]> {`**

Regras (cada uma apenas produz candidatos normalizados)

**`private async executarRegra(`**

Processamento comum: dedup -> registro -> envio -> resolução

**`const candidatoIds = new Set(candidatos.map((c) => c.idVeiculo));`**

Resolução automática: alertas ativos cujo veículo não é mais candidato
tiveram a condição sanada — encerra para permitir novo alerta em caso
de reincidência.

**`if (ativo && ativo.status === StatusNotificacao.ENVIADA) {`**

Deduplicação: alerta ativo já notificado com sucesso — o locador não
recebe e-mail repetido enquanto a condição persistir.

**`if (`**

Dead-letter: alerta que já falhou o número máximo de vezes não é
reprocessado (evita retry infinito contra um provedor indisponível).

## `src/services/notificacao-alerta-veiculo.ts`

**`export interface IAlertaVeiculoDispatcher {`**

Contrato mínimo do qual o serviço de monitoramento depende para despachar
alertas. Novos canais (push/SMS/WhatsApp) entram como outras implementações,
sem alterar as regras de monitoramento.

**`enviar(`**

Envia o alerta e atualiza o registro (ENVIADA/FALHA). Retorna true quando
o provedor aceitou a mensagem. NUNCA lança.

**`export class NotificacaoAlertaVeiculoService implements IAlertaVeiculoDispatcher {`**

Fronteira de envio dos alertas: e-mail via IMailProvider + atualização do
registro. É a fronteira de tratamento de erros do canal: falha de SMTP é
registrada (FALHA + mensagemErro) e logada, mas não propaga — a rotina de
monitoramento continua com os demais alertas.

**`private readonly preferenciaChecker?: IPreferenciaChecker,`**

RN10: opcional. Quando presente, respeita o opt-out do locador para
ALERTA_VEICULO. Ausente (testes antigos) mantém o envio de sempre.

**`if (`**

RN10: respeita o opt-out do locador (destinatário do alerta). Opt-out é
tratado como RESOLVIDO (marcado como enviado -> não reenvia), não como
falha: retorna true para não contar como falhaEnvio nem disparar retry.

**`if (!this.mailProvider.isEnabled()) {`**

Sem provedor configurado (dev/testes): o alerta permanece PENDENTE e
será reencaminhado na próxima execução da rotina.

## `src/services/notificacao-reserva.ts`

**`export interface IReservaNotifier {`**

Contrato mínimo do qual a regra de negócio da reserva depende. Mantém o
ReservaService desacoplado da implementação concreta de notificação/e-mail.

**`export class NotificacaoReservaService implements IReservaNotifier {`**

Orquestra o envio do relatório de reserva por e-mail:
monta o payload -> gera o template -> registra a tentativa -> envia ->
atualiza o registro (sucesso/falha).

É a fronteira de tratamento de erros: NUNCA lança. Qualquer falha (SMTP
indisponível, provedor recusando, erro ao montar payload) é registrada e
logada, mas não propaga — a reserva já concluída não pode ser afetada pelo
envio do e-mail.

**`private readonly preferenciaChecker?: IPreferenciaChecker,`**

Opcional: quando presente, respeita o opt-out do locatário. Ausente
(ex.: testes antigos) mantém o comportamento de sempre enviar.

**`const registro = await this.notificacaoRepository.registrar({`**

Registra a tentativa (PENDENTE) antes de enviar — auditoria mesmo que
o processo caia no meio do envio.

**`await retryComBackoff(() =>`**

Retry com backoff: falhas transitórias de SMTP não derrubam o envio
na primeira tentativa. Só marca FALHA se todas as tentativas falharem.

**`const mensagem = error instanceof Error ? error.message : String(error);`**

Falha antes/fora do envio (montagem do payload, persistência do
registro etc.). Loga e segue — a reserva não é afetada.

## `src/services/notificacao-veiculo-disponivel.ts`

**`export interface IVeiculoDisponivelNotifier {`**

Contrato mínimo do qual a regra de negócio do veículo depende. Mantém o
VeiculoService desacoplado da implementação concreta de notificação/e-mail —
novos canais entram como outras implementações deste contrato (ou novos
providers atrás do dispatcher), sem alterar o fluxo de status do veículo.

**`export class NotificacaoVeiculoDisponivelService`**

Orquestra o disparo das notificações de disponibilidade:
localiza inscrições ATIVAS -> monta o payload -> gera o template ->
registra a tentativa -> envia -> atualiza o registro (sucesso/falha) ->
encerra a inscrição (NOTIFICADO) quando o envio foi aceito.

É a fronteira de tratamento de erros: NUNCA lança. Qualquer falha (SMTP
indisponível, provedor recusando, erro ao montar payload) é registrada e
logada, mas não propaga — a atualização do veículo já concluída não pode ser
afetada pelo envio. A falha em um destinatário não interrompe os demais.

**`private readonly preferenciaChecker?: IPreferenciaChecker,`**

RN11: opcional. Quando presente, respeita o opt-out de cada locatário
para VEICULO_DISPONIVEL. Ausente (testes antigos) mantém o envio.

**`const locador = await this.locadorRepository.findById(veiculo.idLocador);`**

Dados compartilhados por todos os destinatários — resolvidos uma única
vez por disparo (não por interessado).

**`if (`**

RN11: opt-out de um locatário pula apenas aquele destinatário; os
demais continuam recebendo. A inscrição permanece ATIVA.

**`const mensagem = error instanceof Error ? error.message : String(error);`**

Falha fora do envio individual (consulta das inscrições etc.). Loga e
segue — a atualização do veículo não é afetada.

**`const registro = await this.notificacaoInteresseRepository.registrar({`**

Registra a tentativa (PENDENTE) antes de enviar — auditoria mesmo que
o processo caia no meio do envio.

**`await this.interesseRepository.marcarNotificado(`**

Envio aceito: encerra a inscrição para não notificar duas vezes o
mesmo evento. Nova disponibilidade exige nova inscrição (reativação).

**`await this.notificacaoInteresseRepository.marcarFalha(`**

A inscrição permanece ATIVA: uma próxima transição para DISPONIVEL
tentará notificar novamente.

## `src/services/pagamento-estorno.ts`

**`await expirarReservasVencidas({ id: idReserva });`**

Task 11: mesma expiração preguiçosa das demais leituras (D10-03), para
não mostrar "aguardando pagamento" numa reserva já vencida.

## `src/services/pagamento-webhook.ts`

**`const RECUSAS_OPERACIONAIS: string[] = [`**

Recebe webhooks de gateways de pagamento. Responsabilidade: resolver o
gateway, validar a assinatura e traduzir o evento — depois delega a mudança
de estado ao domínio (ReservaService.confirmarPagamento).

Separação: nada do formato do gateway vaza para o domínio; nenhuma regra de
negócio de reserva vive aqui.

**`if (`**

A trilha sandbox e imutável. Depois que este evento foi estornado por
bloqueio, qualquer replay assinado precisa continuar reconhecido sem
alcançar a confirmação da reserva, mesmo se o bloqueio já foi revogado.

**`await this.sandboxAudit.registrarPagamentoRecebido(`**

O pagamento já existia antes do cancelamento. O estorno é o da
chave durável do cancelamento; um replay do webhook não cria uma
segunda identidade de estorno baseada no evento do provedor.

**`if (`**

Um recebimento assinado para conta bloqueada é reconhecido e estornado
apenas no sandbox. Não propagamos 403 ao gateway, evitando reentregas
infinitas; a reserva continua sem confirmação, código ou início.
Task 10.1: o mesmo vale para reserva cujo veículo/garagem ficou
indisponível — a tentativa foi gravada como FALHA e o valor volta.

## `src/services/pagamento.ts`

**`export class PagamentoService {`**

Início do pagamento de uma reserva.

Desenho: este service NÃO confirma pagamento. Ele registra a cobrança, deixa
a reserva em PROCESSANDO e entrega o desfecho ao SIMULADOR DE GATEWAY, que
assina um webhook e o devolve pelo mesmo caminho de um gateway real
(PagamentoWebhookService → verificação de assinatura → ReservaService).

Ou seja: a única porta que muda statusPagamento continua sendo o webhook
assinado. Não existe atalho, nem em sandbox.

**`const desfecho = decidirDesfechoSandbox(dados);`**

Decide o desfecho ANTES de tocar no estado: erro de forma (cartão
ausente/inválido) não deve deixar a reserva em PROCESSANDO.

**`const emProcessamento =`**

Registra a cobrança e coloca a reserva em PROCESSANDO. O valor vem da
reserva (calculado na criação), nunca do cliente.

**`if (desfecho === StatusPagamento.PROCESSANDO) {`**

PROCESSANDO fica pendente: nenhum webhook é disparado. É o cenário de
análise antifraude — o pagamento só resolve quando o gateway decidir.

**`const timer = setTimeout(() => {`**

Com atraso: o cliente recebe PROCESSANDO e faz polling, como num gateway
real. Falha na entrega não derruba a requisição do usuário.

**`private entregarWebhookAssinado = async (`**

O simulador de gateway. Assina o payload canônico com o MESMO segredo e o
MESMO esquema HMAC que a verificação usa, e entrega pelo webhook service —
passando inclusive pela checagem de assinatura.

**`const corpo = montarEventoWebhook(`**

Task 11: cada tentativa é um evento próprio do "gateway" (como nos
sandboxes reais). Uma identidade fixa por reserva+status fazia a trilha
de estorno tratar a nova tentativa como replay do evento já recusado,
e a reserva ficava impagável até expirar.

## `src/services/reserva-report.ts`

**`export class ReservaReportService {`**

Monta o payload do relatório a partir de uma reserva, resolvendo as entidades
relacionadas (veículo, locador, locatário, garagens) e calculando os valores
derivados. Não envia nada — apenas produz o payload e o conteúdo renderizado.
Assim o cálculo do relatório fica testável isoladamente e independente do
canal de envio.

**`async buildReport(`**

Monta o payload e já devolve o conteúdo pronto (assunto/HTML/texto) no
idioma pedido (padrão pt). O idioma afeta só o texto ao usuário, não os dados.

## `src/services/reserva.ts`

**`const atorAuditoria = (requester: ReservaAccessContext) =>`**

RN09 audita as alterações de reserva feitas pelo lado do locador (ou ADMIN);
as ações do próprio locatário seguem o fluxo normal sem trilha de locador.

**`const CODIGO_MAX_TENTATIVAS = 5;`**

tentativas para evitar colisão de unique
Janela de validade do código a partir da data de início (2 dias).

**`const PRAZO_CANCELAMENTO_MS = 2 * 60 * 60 * 1000;`**

RN04: política de cancelamento. Grátis até 2 horas antes da retirada; após
esse prazo, multa de 20% sobre o valor da reserva.

**`const MULTA_ATRASO = 0.1;`**

RN06: atraso na devolução. Cobra a diária PROPORCIONAL ao tempo de atraso
(valorDiaria × atraso/24h, contínuo, sem arredondar para diária cheia) mais
10% sobre essa taxa — cobrança final = taxa × 1,10. A base do 10% é a taxa
de atraso, não o valorTotal da reserva. valorDiaria é a do modelo do
veículo no momento da devolução (ver calcularCobrancaAtraso).

**`const calcularCobrancaAtraso = (valorDiaria: number, atrasoMs: number): number => {`**

RN06: valorDiaria Ã— (atraso / 24h) Ã— 1,10. A unidade intermediÃ¡ria Ã©
centavo para evitar propagaÃ§Ã£o de ponto flutuante antes do arredondamento.

**`private readonly reservaNotifier?: IReservaNotifier,`**

Notificação (relatório por e-mail). Opcional para não acoplar a regra de
negócio ao envio; quando ausente, a reserva funciona normalmente.

**`private async assertLocalDesbloqueio(`**

RN03: exige que o desbloqueio ocorra dentro do raio da última localização
conhecida do veículo. Sem localização de referência, o desbloqueio é
bloqueado: sem uma origem confiável não é possível provar a regra de local.
Com referência, a coordenada do dispositivo é obrigatória. Borda:
distância == raio é válida.

**`private async resolverServicosOpcionais(`**

Valida os serviços opcionais selecionados contra o catálogo e resolve o
valor de cada um (snapshot). Todos os IDs informados devem existir e estar
ativos; caso contrário a reserva não é criada. Centraliza aqui a regra para
evitar cálculos espalhados pela aplicação.

**`private async assertReservaAccess(`**

Garante que o solicitante pode ver/alterar a reserva:
ADMIN sempre; LOCATARIO se for o dono; LOCADOR se o veículo for dele.

**`private resolverGaragemRetirada(`**

O local de retirada é a garagem onde o veículo está atualmente alocado.
Se o solicitante informar um local de retirada, ele deve coincidir.

**`private async resolverDeficienciaParaVeiculoAdaptado(`**

Veículo adaptado (PCD) só pode ser reservado por locatário com deficiência.
Se o locatário ainda não possuir uma, aceita a deficiência informada no
fluxo da reserva, valida-a e a associa ao cadastro.
Valida a elegibilidade PCD e retorna a deficiência a associar ao locatário
(ou undefined quando nada precisa mudar). NÃO grava aqui: a associação é
feita junto da criação da reserva, numa única transação (RN01), para não
deixar o perfil alterado se a criação falhar depois.

**`static calcularValorBase(`**

Garagem inativa/em manutenção não entra em novas reservas (RF19).

Base do valor da reserva: diária do modelo × número de diárias.
Fração de dia conta como diária cheia (mesma regra que a tela exibe e que
RN06 usa para atraso). Estático para ser testável sem instanciar o service.

**`return reservas;`**

Lista vazia é resultado válido, não 404: um locatário recém-cadastrado
deve ver um histórico vazio, não uma tela de erro.

**`precificar = async (data: QuoteReservaInput) => {`**

Precificação autenticada sem persistência. Usa a mesma diária e o mesmo catálogo de serviços
da criação; a criação recalcula novamente para impedir preço obsoleto ou
manipulado entre a visualização e o POST final.

**`const exigeDeficiencia =`**

RN01: "veículo PCD" tem dois marcadores redundantes (adaptado e
categoria=PCD). Exigir só um deixava o outro como brecha (um modelo
categoria=PCD, adaptado=false seria reservável por qualquer um). Trata
como adaptado quando QUALQUER marcador indica PCD.

**`const valorBase = ReservaService.calcularValorBase(`**

VALOR: calculado aqui, nunca recebido do cliente. Base = diária do modelo
× número de diárias (fração conta como diária cheia, igual ao que a tela
exibe), somada aos serviços contratados.

**`return this.reservaRepository.create({`**

A associação da deficiência ao perfil e a criação da reserva ocorrem na
mesma transação (repo) — se a criação falhar, o perfil não é alterado.

**`return this.reservaRepository.update(id, {`**

statusPagamento não vem mais do cliente (removido do schema): o resultado
do pagamento só muda por confirmarPagamento, acionado pelo webhook
assinado do gateway. O PUT trata apenas datas/status/devolução.

**`cancelarReserva = async (`**

RN04: cancelamento como ação de domínio. Grátis até 2h antes da retirada;
após, multa de 20% sobre o valor da reserva, registrada em CobrancaReserva.
Único caminho de cancelamento (PUT /:id não altera mais status).

**`await this.pagamentoEstornoService?.reconciliarEstornoDeCancelamento(id);`**

Se o processo caiu entre o commit do cancelamento e o executor do
estorno, repetir a mesma operação é a reconciliação idempotente.

**`const agora = new Date();`**

Prazo: cancelar após (dataHoraInicio - 2h) é tardio -> multa de 20%.
Task 10 (D10-01): a multa é só do cancelamento tardio do próprio
LOCATÁRIO. LOCADOR (ou ADMIN, atuando na operação) nunca transfere multa
ao locatário; reserva paga segue para estorno integral abaixo. O autor
vem do JWT (requester), nunca do corpo da requisição.

**`devolverReserva = async (`**

RN06: devolução da reserva. Registra devolvidoEm, transiciona para REALIZADA
e, se houver atraso, cobra diária(s) proporcional(is) + 10% (CobrancaReserva
tipo ATRASO_DEVOLUCAO). Só reservas desbloqueadas (código usado) e ainda não
canceladas/concluídas podem ser devolvidas.

**`confirmarPagamento = async (`**

Fluxo INTERNO do gateway de pagamento. Só o webhook (após validar a
assinatura) chega aqui — por isso não passa pela autorização de requester:
a confiança vem da assinatura, não de um JWT de usuário. Centraliza a
mudança de status de pagamento e a geração do código de desbloqueio.

**`const aprovadaSemCodigo =`**

Eventos de gateway podem ser reenviados fora de ordem. Aprovação é
terminal e uma reserva cancelada não pode voltar a receber confirmação.
Task 11: aprovação já gravada mas ainda SEM código (falha entre o commit
do pagamento e a geração) não é terminal — o próximo evento SUCESSO
conclui a confirmação em vez de ser engolido.

**`if (`**

Pagamento confirmado agora e ainda sem código -> gera o código de
desbloqueio e envia o relatório por e-mail (best-effort: o notifier nunca
lança). Idempotente: reserva já confirmada mantém o mesmo código.

**`try {`**

RN07: revalida bloqueio financeiro na trilha do pagamento. Locatário
bloqueado após criar a reserva não pode ser confirmado nem receber o
código pelo webhook. Idempotente: reserva que já tem código não entra
aqui (guard acima), então reprocessamento não dispara 403 espúrio.

**`if (error instanceof HttpError && reserva.statusPagamento !== StatusPagamento.SUCESSO) {`**

Task 11: a tentativa recusada vira FALHA (mesmo desfecho da recusa
operacional da Task 10.1). Sem isso ela ficava PROCESSANDO e uma nova
tentativa era recusada até a reserva expirar. O erro continua
subindo: o webhook registra o recebimento e estorna no sandbox.

**`}`**

Reserva cancelada/expirada entre a leitura e a escrita: o 403 original
prevalece para o webhook registrar o recebimento e estornar.

**`if (atualizada.status === StatusReserva.CANCELADA) {`**

D10-05: o prazo venceu entre a leitura e o lock; a reserva expirou e o
evento tardio não gera código nem confirmação.

**`StatusReserva.CONFIRMADA,`**

Pagamento aprovado promove a reserva de AGUARDANDO_PAGAMENTO para
CONFIRMADA. É a única transição automática de status — e acontece
na mesma operação que gera o código, então nunca ficam dessincronizados.

**`if (confirmada.codigoDesbloqueio === codigo) {`**

Só a entrega que gravou o código notifica; uma entrega concorrente
que perdeu a corrida devolve o estado vencedor sem repetir o e-mail.

**`usarCodigoDesbloqueio = async (`**

Usa o código de desbloqueio do veículo dentro da janela permitida.
Ordem de validação (RN03): código -> horário/uso-único -> local (geofence).

**`return this.reservaRepository.marcarCodigoComoUsado(`**

Desbloqueio efetivado: reserva passa de CONFIRMADA para EM_ANDAMENTO.
É a contraparte da transição do pagamento (AGUARDANDO → CONFIRMADA) e
vale como trava de cancelamento (RN04 recusa cancelar EM_ANDAMENTO).

**`gerarQrDesbloqueio = async (`**

RN03: gera o token assinado embutido no QR Code de desbloqueio. Carrega
idReserva + código; a assinatura (JWT_SECRET) impede adulteração. O QR é
equivalente ao código textual — não dispensa horário/uso-único/local.

**`const qr = jwt.sign(`**

Task 11: o token do QR expira junto com a janela de uso do código (RN03);
antes não tinha validade e continuava verificável para sempre.

**`usarQrDesbloqueio = async (`**

RN03: desbloqueio via QR. Verifica a assinatura, confere que o token é desta
reserva e reusa toda a validação do código textual (não duplica regras).

**`private assertReservaAlteravel(`**

Alterações (incluir/remover condutor) só são permitidas antes do início da
reserva e enquanto ela não estiver cancelada.

**`if (requester.cargo === Cargo.LOCADOR) {`**

Task 11 (RNF05, minimização): o Locador precisa de nome e CNH para a
entrega do veículo; o CPF de terceiros não é necessário a ele.

## `src/services/veiculo-imagem.ts`

**`await this.sincronizarVisibilidadeVeiculo(idVeiculo);`**

A promoção/revogação ocorre somente depois de READY e sob a mesma
reconciliação protegida usada nas mudanças de visibilidade.

**`this.storage.deleteObject({ bucket: env.MEDIA_PUBLIC_BUCKET, key: objectKey }),`**

A promoção é feita pela sincronização final e pode ter criado o
objeto antes de falhar. A chave é nova e opaca, portanto remover os
dois lados é uma compensação segura e independente de onde falhou.

**`` await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${idVeiculo}, 0))`; ``**

O cleanup usa a mesma chave. A operação de storage é curta e fica
protegida pelo lock apenas no comando de reconciliação local; assim a
troca de status e a republicação não se atropelam.

## `src/services/veiculo.ts`

**`constructor(`**

Notifier e recorder são opcionais para não obrigar todos os pontos de
construção (testes, scripts) a fornecê-los; em produção o container injeta.

**`private async registrarTransicaoStatus(`**

Registra a transição de status no histórico (base da regra de inatividade
do monitoramento). Nunca lança: o histórico é auxiliar e a sua falha
(ex.: migration ainda não aplicada) não pode afetar a atualização do
veículo, já persistida.

**`private assertPodeGerenciar(`**

Ownership
ADMIN tem acesso global. LOCADOR só age sobre recursos cujo idLocador
coincide com o seu próprio id. Qualquer outro cargo é negado.

**`listFrota = async (`**

Gestão privada da frota. LOCADOR vê apenas seus veículos em qualquer
status; ADMIN mantém acesso global administrativo.

**`findByLocadorId = async (idLocador: string, pagination: PaginationParams) => {`**

Consulta pública da frota de um locador (catálogo). Usa search(), que
filtra status = DISPONIVEL — não expõe INATIVO/RESERVADO/MANUTENCAO ao
público. A listagem completa (todos os status) é feita pelo locador dono
via GET /api/veiculo autenticado (list()).

**`findById = async (id: string, requester?: VeiculoRequester) => {`**

Detalhe público. Veículo INATIVO (desativado) é tratado como inexistente
para o público — não deve aparecer no catálogo.

**`if (`**

Disparo automático da watchlist: apenas na TRANSIÇÃO para DISPONIVEL
(não em updates que já estavam DISPONIVEL). O notifier nunca lança —
falha de envio não afeta a atualização do veículo, já persistida.

**`this.assertPodeGerenciar(requester, veiculo.idLocador);`**

O locador só gerencia os próprios veículos e não pode reapontar o
veículo para um modelo de outro locador.

# Notas de implementação — src/routes

Texto que ficava em comentários de várias linhas no código. Cada seção indica o arquivo e o trecho que o comentário acompanhava.

## `src/routes/admin/admin.ts`

**`adminRouter.post(`**

MONITORAMENTO DA FROTA (somente ADMIN) — acionamento manual da rotina que
normalmente roda via scheduler no boot.

## `src/routes/avaliacao/avaliacao.ts`

**`avaliacaoRouter.get(`**

Dashboard analítico exclusivo do LOCADOR (apenas dos próprios veículos).
Declarado antes de "/reserva/:id_reserva" — rota estática, sem conflito.

## `src/routes/container.ts`

**`export const veiculoImagemService = new VeiculoImagemService();`**

veiculoService/veiculoController são criados mais abaixo: dependem do
notifier de disponibilidade, que por sua vez depende do mailProvider e dos
repositórios de interesse/garagem.

**`export const mailProvider: IMailProvider = new NodemailerMailProvider(`**

Camada de infraestrutura de e-mail. Provedor concreto (Nodemailer/SMTP) fica
atrás da abstração IMailProvider — trocar por SES/Resend/etc. é só instanciar
outra implementação aqui, sem tocar nos services.

Em NODE_ENV=test o provedor fica desabilitado (config vazia) mesmo com SMTP
no .env: a suíte de integração jamais envia e-mail real — o PUT de reserva
travava >5s no handshake SMTP e estourava o timeout do vitest. O envio real
é opt-in apenas em test/notificacao/real-email.test.ts, que monta o próprio
provedor. SEND_REAL_EMAIL=false desliga o envio também fora de teste (demo
local com contas fictícias não deve disparar SMTP real).

**`export const preferenciaNotificacaoRepository: IPreferenciaNotificacaoRepository = new ...`**

Preferências de notificação (opt-in/opt-out). O repositório também serve de
checker de opt-out para os notificadores.

**`export const interesseRepository: IInteresseVeiculoRepository = new PrismaInteresseVeic...`**

Watchlist de disponibilidade de veículos: inscrições de interesse + registro
dos envios + dispatcher que notifica quando o veículo volta a DISPONIVEL.

**`export const monitoramentoRepository: IMonitoramentoVeiculoRepository = new PrismaMonit...`**

Monitoramento da frota: histórico de status + alertas (inatividade e baixa
avaliação), com dispatcher de e-mail e rotina periódica opcional no boot.

**`export const localizacaoRepository: ILocalizacaoRepository = new PrismaLocalizacaoRepos...`**

Localização (RN03): referência do geofence de desbloqueio; instanciada aqui
para ser injetada no ReservaService (o LocalizacaoService a reusa mais abaixo).

**`export const gatewaysPagamento = construirGatewaysPagamento();`**

Webhook de pagamento: registro de gateways (Mercado Pago/Stripe/Asaas) +
service que valida assinatura e delega a confirmação ao domínio.

**`export const pagamentoService = new PagamentoService(reservaRepository, pagamentoWebhoo...`**

Início do pagamento (sandbox). Entrega o desfecho pelo MESMO webhook service,
com assinatura — não existe caminho paralelo para confirmar pagamento.

**`export const locadorDashboardRepository: ILocadorDashboardRepository = new PrismaLocado...`**

Dashboard do locador (RF17/RF18): relatórios de reservas, financeiro,
utilização da frota e visão de status/localização/alertas.

**`export const localizacaoSimulador = new LocalizacaoSimulador(`**

Simulador de rastreador (não integra GPS real). Iniciado opcionalmente no
boot do servidor; ver src/server.ts.

## `src/routes/dashboard/dashboard.ts`

**`const dashboardRouter = Router();`**

Dashboard do locador (RF17/RF18). Exclusivo do LOCADOR; todos os dados são
dos próprios veículos (idLocador do token).

## `src/routes/favorito/favorito.ts`

**`favoritoRouter.get(`**

Favoritos pertencem exclusivamente ao locatário autenticado (req.user.id) —
nenhuma rota aceita id de locatário como parâmetro.

## `src/routes/health/health.ts`

**`export function createHealthRouter(`**

Router de health/readiness. Recebe o ping por injeção para ser testável sem
derrubar o banco real (o teste passa um ping que lança).

**`router.get("/ready", async (req, res) => {`**

Readiness: apto a servir tráfego — valida a conexão com o banco.
200 quando o banco responde; 503 quando indisponível. O detalhe do erro
vai apenas para o log interno (não é exposto ao cliente).

## `src/routes/interesse/interesse.ts`

**`interesseRouter.get(`**

Inscrições de interesse pertencem exclusivamente ao locatário autenticado
(req.user.id) — nenhuma rota aceita id de locatário como parâmetro.

## `src/routes/reserva/reserva.ts`

**`reservaRouter.post(`**

Pagamento (sandbox). Só o dono da reserva inicia; a confirmação vem do
webhook assinado, nunca daqui.

**`reservaRouter.get(`**

QR Code de desbloqueio (RN03): GET obtém o token assinado; POST desbloqueia
resolvendo o QR para o mesmo código textual.

## `src/routes/veiculo/veiculo.ts`

**`const gerencia = [authMiddleware, authorize(Cargo.LOCADOR, Cargo.ADMIN)];`**

Escrita: exige autenticação e cargo LOCADOR/ADMIN. A posse do recurso
(locador só mexe nos próprios veículos/modelos) é validada no service.

**`veiculoRouter.get("/locador/:id_locador", veiculoController.findByLocadorId);`**

Consulta pública (catálogo)
Não expõem veículos INATIVO; listagem por locador retorna só DISPONIVEL
(regra aplicada no VeiculoService).

**`veiculoRouter.get("/meus", ...gerencia, veiculoController.frota);`**

Gestão de frota: proprietário é derivado do JWT. Nunca aceitar idLocador
arbitrário do cliente neste contexto.

## `src/routes/webhook/webhook.ts`

**`webhookRouter.post(`**

Webhook de gateway de pagamento. SEM autenticação por JWT — a confiança vem
da assinatura validada no service. express.raw preserva o corpo cru (bytes
exatos) necessário para conferir o HMAC; por isso este router é montado ANTES
do express.json global (ver app.ts).

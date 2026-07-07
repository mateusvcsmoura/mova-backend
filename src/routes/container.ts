import { LocadorDashboardController } from "../controllers/locador-dashboard.js";
import { LocadorDashboardService } from "../services/locador-dashboard.js";
import { ILocadorDashboardRepository } from "../repositories/locador-dashboard.repository.js";
import { PrismaLocadorDashboardRepository } from "../repositories/prisma/prisma.locador-dashboard.repository.js";
import { AvaliacaoController } from "../controllers/avaliacao.js";
import { AvaliacaoRelatorioController } from "../controllers/avaliacao-relatorio.js";
import { FavoritoController } from "../controllers/favorito.js";
import { BloqueioController } from "../controllers/bloqueio.js";
import { ContaController } from "../controllers/conta.js";
import { DeficienciaController } from "../controllers/deficiencia.js";
import { GaragemController } from "../controllers/garagem.js";
import { LocalizacaoController } from "../controllers/localizacao.js";
import { LocadorController } from "../controllers/locador.js";
import { LocatarioController } from "../controllers/locatario.js";
import { ReservaController } from "../controllers/reserva.js";
import { ServicoOpcionalController } from "../controllers/servico-opcional.js";
import { VeiculoController } from "../controllers/veiculo.js";
import { IContaRepository } from "../repositories/conta.repository.js";
import { IDeficienciaRepository } from "../repositories/deficiencia.repository.js";
import { IGaragemRepository } from "../repositories/garagem.repository.js";
import { ILocalizacaoRepository } from "../repositories/localizacao.repository.js";
import { ILocadorRepository } from "../repositories/locador.repository.js";
import { ILocatarioRepository } from "../repositories/locatario.repository.js";
import { PrismaAvaliacaoRepository } from "../repositories/prisma/prisma.avaliacao.repository.js";
import { PrismaAvaliacaoRelatorioRepository } from "../repositories/prisma/prisma.avaliacao-relatorio.repository.js";
import { IAvaliacaoRelatorioRepository } from "../repositories/avaliacao-relatorio.repository.js";
import { PrismaFavoritoRepository } from "../repositories/prisma/prisma.favorito.repository.js";
import { IFavoritoRepository } from "../repositories/favorito.repository.js";
import { PrismaBloqueioRepository } from "../repositories/prisma/prisma.bloqueio.repository.js";
import { IBloqueioRepository } from "../repositories/bloqueio.repository.js";
import { PrismaContaRepository } from "../repositories/prisma/prisma.conta.repository.js";
import { PrismaDeficienciaRepository } from "../repositories/prisma/prisma.deficiencia.repository.js";
import { PrismaGaragemRepository } from "../repositories/prisma/prisma.garagem.repository.js";
import { PrismaLocalizacaoRepository } from "../repositories/prisma/prisma.localizacao.repository.js";
import { PrismaLocadorRepository } from "../repositories/prisma/prisma.locador.repository.js";
import { PrismaLocatarioRepository } from "../repositories/prisma/prisma.locatario.repository.js";
import { PrismaReservaRepository } from "../repositories/prisma/prisma.reserva.repository.js";
import { ICondutorRepository } from "../repositories/condutor.repository.js";
import { PrismaCondutorRepository } from "../repositories/prisma/prisma.condutor.repository.js";
import { PrismaServicoOpcionalRepository } from "../repositories/prisma/prisma.servico-opcional.repository.js";
import { PrismaVeiculoRepository } from "../repositories/prisma/prisma.veiculo.repository.js";
import { IReservaRepository } from "../repositories/reserva.repository.js";
import { IServicoOpcionalRepository } from "../repositories/servico-opcional.repository.js";
import { IAvaliacaoRepository } from "../repositories/avaliacao.repository.js";
import { IVeiculoRepository } from "../repositories/veiculo.repository.js";
import { ContaService } from "../services/conta.js";
import { DeficienciaService } from "../services/deficiencia.js";
import { GaragemService } from "../services/garagem.js";
import { LocalizacaoService } from "../services/localizacao.js";
import { LocalizacaoSimulador } from "../services/localizacao-simulador.js";
import { LocadorService } from "../services/locador.js";
import { LocatarioService } from "../services/locatario.js";
import { ReservaService } from "../services/reserva.js";
import { ServicoOpcionalService } from "../services/servico-opcional.js";
import { BloqueioService } from "../services/bloqueio.js";
import { AvaliacaoService } from "../services/avaliacao.js";
import { AvaliacaoRelatorioService } from "../services/avaliacao-relatorio.js";
import { FavoritoService } from "../services/favorito.js";
import { VeiculoService } from "../services/veiculo.js";
import { INotificacaoRepository } from "../repositories/notificacao.repository.js";
import { PrismaNotificacaoRepository } from "../repositories/prisma/prisma.notificacao.repository.js";
import { NodemailerMailProvider } from "../infra/email/nodemailer.provider.js";
import { IMailProvider } from "../infra/email/mail-provider.js";
import { ReservaReportService } from "../services/reserva-report.js";
import { NotificacaoReservaService } from "../services/notificacao-reserva.js";
import { IInteresseVeiculoRepository } from "../repositories/interesse.repository.js";
import { PrismaInteresseVeiculoRepository } from "../repositories/prisma/prisma.interesse.repository.js";
import { INotificacaoInteresseRepository } from "../repositories/notificacao-interesse.repository.js";
import { PrismaNotificacaoInteresseRepository } from "../repositories/prisma/prisma.notificacao-interesse.repository.js";
import { NotificacaoVeiculoDisponivelService } from "../services/notificacao-veiculo-disponivel.js";
import { InteresseVeiculoService } from "../services/interesse-veiculo.js";
import { InteresseController } from "../controllers/interesse.js";
import { IMonitoramentoVeiculoRepository } from "../repositories/monitoramento.repository.js";
import { PrismaMonitoramentoVeiculoRepository } from "../repositories/prisma/prisma.monitoramento.repository.js";
import { NotificacaoAlertaVeiculoService } from "../services/notificacao-alerta-veiculo.js";
import { MonitoramentoVeiculoService } from "../services/monitoramento-veiculo.js";
import { MonitoramentoScheduler } from "../services/monitoramento-scheduler.js";
import { MonitoramentoController } from "../controllers/monitoramento.js";
import { construirGatewaysPagamento } from "../infra/payment/gateway.js";
import { PagamentoWebhookService } from "../services/pagamento-webhook.js";
import { PagamentoWebhookController } from "../controllers/pagamento-webhook.js";
import { ILgpdRepository } from "../repositories/lgpd.repository.js";
import { PrismaLgpdRepository } from "../repositories/prisma/prisma.lgpd.repository.js";
import { LgpdService } from "../services/lgpd.js";
import { LgpdController } from "../controllers/lgpd.js";
import { env } from "../config/env.js";

export const locadorRepository: ILocadorRepository = new PrismaLocadorRepository();
export const locadorService = new LocadorService(locadorRepository);
export const locadorController = new LocadorController(locadorService);

export const locatarioRepository: ILocatarioRepository = new PrismaLocatarioRepository();
export const locatarioService = new LocatarioService(locatarioRepository);
export const locatarioController = new LocatarioController(locatarioService);

export const contaRepository: IContaRepository = new PrismaContaRepository();
export const contaService = new ContaService(contaRepository, locadorRepository, locatarioRepository);
export const contaController = new ContaController(contaService);

export const deficienciaRepository: IDeficienciaRepository = new PrismaDeficienciaRepository();
export const deficienciaService = new DeficienciaService(deficienciaRepository);
export const deficienciaController = new DeficienciaController(deficienciaService);

export const veiculoRepository: IVeiculoRepository = new PrismaVeiculoRepository();
// veiculoService/veiculoController são criados mais abaixo: dependem do
// notifier de disponibilidade, que por sua vez depende do mailProvider e dos
// repositórios de interesse/garagem.

export const garagemRepository: IGaragemRepository = new PrismaGaragemRepository();
export const garagemService = new GaragemService(garagemRepository, veiculoRepository);
export const garagemController = new GaragemController(garagemService);

export const bloqueioRepository: IBloqueioRepository = new PrismaBloqueioRepository();
export const bloqueioService = new BloqueioService(bloqueioRepository, locatarioRepository);
export const bloqueioController = new BloqueioController(bloqueioService);

export const servicoOpcionalRepository: IServicoOpcionalRepository = new PrismaServicoOpcionalRepository();
export const servicoOpcionalService = new ServicoOpcionalService(servicoOpcionalRepository);
export const servicoOpcionalController = new ServicoOpcionalController(servicoOpcionalService);

// Camada de infraestrutura de e-mail. Provedor concreto (Nodemailer/SMTP) fica
// atrás da abstração IMailProvider — trocar por SES/Resend/etc. é só instanciar
// outra implementação aqui, sem tocar nos services.
//
// Em NODE_ENV=test o provedor fica desabilitado (config vazia) mesmo com SMTP
// no .env: a suíte de integração jamais envia e-mail real — o PUT de reserva
// travava >5s no handshake SMTP e estourava o timeout do vitest. O envio real
// é opt-in apenas em test/notificacao/real-email.test.ts, que monta o próprio
// provedor.
export const mailProvider: IMailProvider = new NodemailerMailProvider(
  env.NODE_ENV === "test"
    ? {}
    : {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        from: env.SMTP_FROM,
      },
);

export const notificacaoRepository: INotificacaoRepository = new PrismaNotificacaoRepository();
export const reservaReportService = new ReservaReportService(veiculoRepository, contaRepository, locadorRepository, garagemRepository);
export const notificacaoReservaService = new NotificacaoReservaService(reservaReportService, mailProvider, notificacaoRepository);

// Watchlist de disponibilidade de veículos: inscrições de interesse + registro
// dos envios + dispatcher que notifica quando o veículo volta a DISPONIVEL.
export const interesseRepository: IInteresseVeiculoRepository = new PrismaInteresseVeiculoRepository();
export const notificacaoInteresseRepository: INotificacaoInteresseRepository = new PrismaNotificacaoInteresseRepository();
export const notificacaoVeiculoDisponivelService = new NotificacaoVeiculoDisponivelService(interesseRepository, notificacaoInteresseRepository, locadorRepository, garagemRepository, mailProvider);

// Monitoramento da frota: histórico de status + alertas (inatividade e baixa
// avaliação), com dispatcher de e-mail e rotina periódica opcional no boot.
export const monitoramentoRepository: IMonitoramentoVeiculoRepository = new PrismaMonitoramentoVeiculoRepository();
export const notificacaoAlertaVeiculoService = new NotificacaoAlertaVeiculoService(monitoramentoRepository, mailProvider);
export const monitoramentoVeiculoService = new MonitoramentoVeiculoService(monitoramentoRepository, notificacaoAlertaVeiculoService);
export const monitoramentoController = new MonitoramentoController(monitoramentoVeiculoService);
export const monitoramentoScheduler = new MonitoramentoScheduler(
  monitoramentoVeiculoService,
  {
    intervaloMs: Number(process.env.MONITORAMENTO_INTERVALO_MS) || 3_600_000,
  },
);

export const veiculoService = new VeiculoService(veiculoRepository, notificacaoVeiculoDisponivelService, monitoramentoRepository);
export const veiculoController = new VeiculoController(veiculoService);

export const interesseService = new InteresseVeiculoService(interesseRepository, veiculoRepository, locatarioRepository);
export const interesseController = new InteresseController(interesseService);

export const reservaRepository: IReservaRepository = new PrismaReservaRepository();
export const condutorRepository: ICondutorRepository = new PrismaCondutorRepository();
export const reservaService = new ReservaService(reservaRepository, veiculoRepository, locatarioRepository, garagemRepository, deficienciaRepository, bloqueioService, servicoOpcionalRepository, condutorRepository, notificacaoReservaService);
export const reservaController = new ReservaController(reservaService);

// Webhook de pagamento: registro de gateways (Mercado Pago/Stripe/Asaas) +
// service que valida assinatura e delega a confirmação ao domínio.
export const gatewaysPagamento = construirGatewaysPagamento();
export const pagamentoWebhookService = new PagamentoWebhookService(gatewaysPagamento, reservaService);
export const pagamentoWebhookController = new PagamentoWebhookController(pagamentoWebhookService);

// LGPD: exportação, anonimização e auditoria de acesso a dados pessoais.
export const lgpdRepository: ILgpdRepository = new PrismaLgpdRepository();
export const lgpdService = new LgpdService(lgpdRepository);
export const lgpdController = new LgpdController(lgpdService);

export const avaliacaoRepository: IAvaliacaoRepository = new PrismaAvaliacaoRepository();
export const avaliacaoService = new AvaliacaoService(avaliacaoRepository, reservaRepository, veiculoRepository);
export const avaliacaoController = new AvaliacaoController(avaliacaoService);

export const avaliacaoRelatorioRepository: IAvaliacaoRelatorioRepository = new PrismaAvaliacaoRelatorioRepository();
export const avaliacaoRelatorioService = new AvaliacaoRelatorioService(avaliacaoRelatorioRepository);
export const avaliacaoRelatorioController = new AvaliacaoRelatorioController(avaliacaoRelatorioService);

// Dashboard do locador (RF17/RF18): relatórios de reservas, financeiro,
// utilização da frota e visão de status/localização/alertas.
export const locadorDashboardRepository: ILocadorDashboardRepository = new PrismaLocadorDashboardRepository();
export const locadorDashboardService = new LocadorDashboardService(locadorDashboardRepository);
export const locadorDashboardController = new LocadorDashboardController(locadorDashboardService);

export const favoritoRepository: IFavoritoRepository = new PrismaFavoritoRepository();
export const favoritoService = new FavoritoService(favoritoRepository, veiculoRepository, locatarioRepository);
export const favoritoController = new FavoritoController(favoritoService);

export const localizacaoRepository: ILocalizacaoRepository = new PrismaLocalizacaoRepository();
export const localizacaoService = new LocalizacaoService(localizacaoRepository, veiculoRepository, reservaRepository);
export const localizacaoController = new LocalizacaoController(localizacaoService);

// Simulador de rastreador (não integra GPS real). Iniciado opcionalmente no
// boot do servidor; ver src/server.ts.
export const localizacaoSimulador = new LocalizacaoSimulador(
  veiculoRepository,
  localizacaoRepository,
  localizacaoService,
  {
    intervaloMs: Number(process.env.LOCALIZACAO_SIMULADOR_INTERVALO_MS) || 15_000,
  },
);

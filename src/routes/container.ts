import { AvaliacaoController } from "../controllers/avaliacao.js";
import { ContaController } from "../controllers/conta.js";
import { DeficienciaController } from "../controllers/deficiencia.js";
import { GaragemController } from "../controllers/garagem.js";
import { LocalizacaoController } from "../controllers/localizacao.js";
import { LocadorController } from "../controllers/locador.js";
import { LocatarioController } from "../controllers/locatario.js";
import { ReservaController } from "../controllers/reserva.js";
import { VeiculoController } from "../controllers/veiculo.js";
import { IContaRepository } from "../repositories/conta.repository.js";
import { IDeficienciaRepository } from "../repositories/deficiencia.repository.js";
import { IGaragemRepository } from "../repositories/garagem.repository.js";
import { ILocalizacaoRepository } from "../repositories/localizacao.repository.js";
import { ILocadorRepository } from "../repositories/locador.repository.js";
import { ILocatarioRepository } from "../repositories/locatario.repository.js";
import { PrismaAvaliacaoRepository } from "../repositories/prisma/prisma.avaliacao.repository.js";
import { PrismaContaRepository } from "../repositories/prisma/prisma.conta.repository.js";
import { PrismaDeficienciaRepository } from "../repositories/prisma/prisma.deficiencia.repository.js";
import { PrismaGaragemRepository } from "../repositories/prisma/prisma.garagem.repository.js";
import { PrismaLocalizacaoRepository } from "../repositories/prisma/prisma.localizacao.repository.js";
import { PrismaLocadorRepository } from "../repositories/prisma/prisma.locador.repository.js";
import { PrismaLocatarioRepository } from "../repositories/prisma/prisma.locatario.repository.js";
import { PrismaReservaRepository } from "../repositories/prisma/prisma.reserva.repository.js";
import { PrismaVeiculoRepository } from "../repositories/prisma/prisma.veiculo.repository.js";
import { IReservaRepository } from "../repositories/reserva.repository.js";
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
import { AvaliacaoService } from "../services/avaliacao.js";
import { VeiculoService } from "../services/veiculo.js";

export const locadorRepository: ILocadorRepository = new PrismaLocadorRepository();
export const locadorService = new LocadorService(locadorRepository);
export const locadorController = new LocadorController(locadorService);

export const locatarioRepository: ILocatarioRepository = new PrismaLocatarioRepository();
export const locatarioService = new LocatarioService(locatarioRepository);
export const locatarioController = new LocatarioController(locatarioService);

const contaRepository: IContaRepository = new PrismaContaRepository();
export const contaService = new ContaService(contaRepository, locadorRepository, locatarioRepository);
export const contaController = new ContaController(contaService);

export const deficienciaRepository: IDeficienciaRepository = new PrismaDeficienciaRepository();
export const deficienciaService = new DeficienciaService(deficienciaRepository);
export const deficienciaController = new DeficienciaController(deficienciaService);

export const veiculoRepository: IVeiculoRepository = new PrismaVeiculoRepository();
export const veiculoService = new VeiculoService(veiculoRepository);
export const veiculoController = new VeiculoController(veiculoService);

export const garagemRepository: IGaragemRepository = new PrismaGaragemRepository();
export const garagemService = new GaragemService(garagemRepository, veiculoRepository);
export const garagemController = new GaragemController(garagemService);

export const reservaRepository: IReservaRepository = new PrismaReservaRepository();
export const reservaService = new ReservaService(reservaRepository, veiculoRepository, locatarioRepository, garagemRepository, deficienciaRepository);
export const reservaController = new ReservaController(reservaService);

export const avaliacaoRepository: IAvaliacaoRepository = new PrismaAvaliacaoRepository();
export const avaliacaoService = new AvaliacaoService(avaliacaoRepository, reservaRepository, veiculoRepository);
export const avaliacaoController = new AvaliacaoController(avaliacaoService);

export const localizacaoRepository: ILocalizacaoRepository = new PrismaLocalizacaoRepository();
export const localizacaoService = new LocalizacaoService(localizacaoRepository, veiculoRepository);
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

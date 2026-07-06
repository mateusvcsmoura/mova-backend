import { Cargo, StatusVeiculo } from "@prisma/client";
import { HttpError } from "../errors/HttpError.js";
import {
  CreateVeiculoLoteRequest,
  CreateVeiculoRequest,
  ListVeiculosRequest,
  ModeloVeiculoData,
  UpdateModeloVeiculoRequest,
  UpdateVeiculoRequest,
  VeiculoFilters,
} from "../repositories/contracts/veiculo.contract.js";
import { IVeiculoRepository } from "../repositories/veiculo.repository.js";
import { IVeiculoStatusRecorder } from "../repositories/monitoramento.repository.js";
import { IVeiculoDisponivelNotifier } from "./notificacao-veiculo-disponivel.js";
import { PaginationParams } from "../shared/pagination.js";

// Contexto do requisitante autenticado (populado pelo authMiddleware).
interface VeiculoRequester {
  id: string;
  cargo: Cargo;
}

export class VeiculoService {
  // Notifier e recorder são opcionais para não obrigar todos os pontos de
  // construção (testes, scripts) a fornecê-los; em produção o container injeta.
  constructor(
    private veiculoRepository: IVeiculoRepository,
    private readonly disponibilidadeNotifier?: IVeiculoDisponivelNotifier,
    private readonly statusRecorder?: IVeiculoStatusRecorder,
  ) {}

  // Registra a transição de status no histórico (base da regra de inatividade
  // do monitoramento). Nunca lança: o histórico é auxiliar e a sua falha
  // (ex.: migration ainda não aplicada) não pode afetar a atualização do
  // veículo, já persistida.
  private async registrarTransicaoStatus(
    idVeiculo: string,
    status: StatusVeiculo,
  ): Promise<void> {
    if (!this.statusRecorder) return;
    try {
      await this.statusRecorder.registrarStatus(idVeiculo, status);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      console.error(
        `[monitoramento] falha ao registrar transição de status do veículo ${idVeiculo}: ${mensagem}`,
      );
    }
  }

  // ── Ownership ───────────────────────────────────────────────────────────
  // ADMIN tem acesso global. LOCADOR só age sobre recursos cujo idLocador
  // coincide com o seu próprio id. Qualquer outro cargo é negado.
  private assertPodeGerenciar(
    requester: VeiculoRequester,
    idLocadorDoRecurso: string,
  ) {
    if (requester.cargo === Cargo.ADMIN) return;
    if (requester.cargo !== Cargo.LOCADOR || requester.id !== idLocadorDoRecurso) {
      throw new HttpError(403, "Acesso negado");
    }
  }

  list = async (data: ListVeiculosRequest) => {
    switch (data.cargo) {
      case "ADMIN":
        return data.filters
          ? await this.veiculoRepository.search(data.filters, data.pagination)
          : await this.veiculoRepository.findAll(data.pagination);

      case "LOCADOR":
        return data.filters
          ? await this.veiculoRepository.search(
              {
                ...data.filters,
                idLocador: data.id, // garante que só vê os próprios
              },
              data.pagination,
            )
          : await this.veiculoRepository.findByLocadorId(
              data.id,
              data.pagination,
            );

      case "LOCATARIO":
        return await this.veiculoRepository.search(
          data.filters ?? {},
          data.pagination,
        );

      default:
        throw new HttpError(403, "Acesso negado");
    }
  };

  // Consulta pública da frota de um locador (catálogo). Usa search(), que
  // filtra status = DISPONIVEL — não expõe INATIVO/RESERVADO/MANUTENCAO ao
  // público. A listagem completa (todos os status) é feita pelo locador dono
  // via GET /api/veiculo autenticado (list()).
  findByLocadorId = async (idLocador: string, pagination: PaginationParams) => {
    const veiculos = await this.veiculoRepository.search(
      { idLocador },
      pagination,
    );
    if (veiculos.total === 0) {
      throw new HttpError(404, "Nenhum veículo encontrado para este locador");
    }
    return veiculos;
  };

  // Detalhe público. Veículo INATIVO (desativado) é tratado como inexistente
  // para o público — não deve aparecer no catálogo.
  findById = async (id: string) => {
    const veiculo = await this.veiculoRepository.findById(id);
    if (!veiculo || veiculo.status === StatusVeiculo.INATIVO) {
      throw new HttpError(404, "Veículo não encontrado");
    }
    return veiculo;
  };

  findByPlaca = async (placa: string) => {
    const veiculo = await this.veiculoRepository.findByPlaca(placa);
    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }
    return veiculo;
  };

  search = async (filters: VeiculoFilters, pagination: PaginationParams) => {
    const veiculos = await this.veiculoRepository.search(filters, pagination);
    if (veiculos.total === 0) {
      throw new HttpError(
        404,
        "Nenhum veículo encontrado com os filtros fornecidos",
      );
    }
    return veiculos;
  };

  create = async (data: CreateVeiculoRequest, requester: VeiculoRequester) => {
    this.assertPodeGerenciar(requester, data.idLocador);

    const existing = await this.veiculoRepository.findByPlaca(data.placa);
    if (existing) {
      throw new HttpError(409, "Veículo com esta placa já existe");
    }
    return this.veiculoRepository.create({
      ...data,
      status: data.status ?? StatusVeiculo.DISPONIVEL,
    });
  };

  createLote = async (
    data: CreateVeiculoLoteRequest,
    requester: VeiculoRequester,
  ) => {
    this.assertPodeGerenciar(requester, data.idLocador);

    if (!data.placas || data.placas.length === 0) {
      throw new HttpError(400, "Informe ao menos uma placa");
    }

    // Verifica duplicatas dentro da própria lista enviada
    const placasUnicas = new Set(data.placas);
    if (placasUnicas.size !== data.placas.length) {
      throw new HttpError(400, "A lista contém placas duplicadas");
    }

    // Verifica quais placas já existem no banco
    const duplicadas = (
      await Promise.all(
        data.placas.map((placa) => this.veiculoRepository.findByPlaca(placa)),
      )
    )
      .filter(Boolean)
      .map((v) => v!.placa);

    if (duplicadas.length > 0) {
      throw new HttpError(
        409,
        `As seguintes placas já estão cadastradas: ${duplicadas.join(", ")}`,
      );
    }

    return this.veiculoRepository.createLote(data);
  };

  update = async (
    id: string,
    data: UpdateVeiculoRequest,
    requester: VeiculoRequester,
  ) => {
    const veiculo = await this.veiculoRepository.findById(id);
    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }
    this.assertPodeGerenciar(requester, veiculo.idLocador);
    const atualizado = await this.veiculoRepository.update(id, data);

    // Histórico de transições (monitoramento de inatividade).
    if (veiculo.status !== atualizado.status) {
      await this.registrarTransicaoStatus(atualizado.id, atualizado.status);
    }

    // Disparo automático da watchlist: apenas na TRANSIÇÃO para DISPONIVEL
    // (não em updates que já estavam DISPONIVEL). O notifier nunca lança —
    // falha de envio não afeta a atualização do veículo, já persistida.
    if (
      this.disponibilidadeNotifier &&
      veiculo.status !== StatusVeiculo.DISPONIVEL &&
      atualizado.status === StatusVeiculo.DISPONIVEL
    ) {
      await this.disponibilidadeNotifier.notificarVeiculoDisponivel(atualizado);
    }

    return atualizado;
  };

  delete = async (id: string, requester: VeiculoRequester) => {
    const veiculo = await this.veiculoRepository.findById(id);
    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }
    this.assertPodeGerenciar(requester, veiculo.idLocador);
    return this.veiculoRepository.delete(id);
  };

  updateModelo = async (
    idModelo: string,
    data: UpdateModeloVeiculoRequest,
    requester: VeiculoRequester,
  ) => {
    const hasData = Object.values(data).some((v) => v !== undefined);
    if (!hasData) {
      throw new HttpError(400, "Nenhum campo informado para atualização.");
    }

    const modelo = await this.veiculoRepository.findModeloById(idModelo);
    if (!modelo) {
      throw new HttpError(404, "Modelo de veículo não encontrado.");
    }
    this.assertPodeGerenciar(requester, modelo.idLocador);

    return this.veiculoRepository.updateModelo(idModelo, data);
  };

  updateModeloDoVeiculo = async (
    idVeiculo: string,
    data: ModeloVeiculoData,
    requester: VeiculoRequester,
  ) => {
    const veiculo = await this.veiculoRepository.findById(idVeiculo);
    if (!veiculo) {
      throw new HttpError(404, "Veículo não encontrado");
    }
    // O locador só gerencia os próprios veículos e não pode reapontar o
    // veículo para um modelo de outro locador.
    this.assertPodeGerenciar(requester, veiculo.idLocador);
    this.assertPodeGerenciar(requester, data.idLocador);
    if (data.idLocador !== veiculo.idLocador) {
      throw new HttpError(
        403,
        "O modelo precisa pertencer ao mesmo locador do veículo",
      );
    }

    return this.veiculoRepository.updateModeloDoVeiculo(idVeiculo, data);
  };
}

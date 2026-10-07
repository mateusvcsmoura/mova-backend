import {
  CategoriaVeiculo,
  MetodoPagamento,
  StatusPagamento,
  StatusReserva,
} from "@prisma/client";

export interface ReservaReportPayload {
  reserva: {
    id: string;
    criadaEm: Date;
    status: StatusReserva;
    statusPagamento: StatusPagamento;
    dataHoraInicio: Date;
    dataHoraFim: Date;
    dias: number;
    valorBase: number;
    valorServicos: number;
    valorTotal: number;
    codigoDesbloqueio: string | null;
    // Forma de pagamento escolhida (RF11). Null quando não informada.
    metodoPagamento: MetodoPagamento | null;
  };
  veiculo: {
    marca: string;
    modelo: string;
    ano: number;
    placa: string;
    // Atributos do modelo — já disponíveis no veículo resolvido (sem query extra).
    categoria: CategoriaVeiculo | null;
    cambio: string;
    capacidade: number;
    eletrico: boolean;
    adaptado: boolean;
  };
  locador: {
    empresa: string;
  };
  locatario: {
    nome: string;
    email: string;
  };
  retirada: {
    garagem: string;
    endereco: string;
  } | null;
  devolucao: {
    garagem: string;
    endereco: string;
  } | null;
  servicos: {
    nome: string;
    descricao: string;
    valor: number;
  }[];
}

// Conteúdo pronto para envio, gerado a partir do payload.
export interface ReservaReportContent {
  subject: string;
  html: string;
  text: string;
}

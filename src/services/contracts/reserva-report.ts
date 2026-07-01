import { StatusPagamento, StatusReserva } from "@prisma/client";

// Payload do relatório de reserva. É a estrutura intermediária, independente do
// formato de saída (HTML/texto/futuro PDF) e das entidades do Prisma. O builder
// monta este payload; os templates apenas o consomem.
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
  };
  veiculo: {
    marca: string;
    modelo: string;
    ano: number;
    placa: string;
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

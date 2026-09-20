import { StatusReserva } from "@prisma/client";

export interface CompartilhamentoAtivo {
  token: string;
  criadoEm: Date;
}

export interface CompartilhamentoLinkResponse extends CompartilhamentoAtivo {
  urlPath: string;
}

export interface CompartilhamentoLocalPublico {
  nome: string;
  endereco: string;
}

export interface CompartilhamentoPublico {
  viagem: {
    dataHoraInicio: Date;
    dataHoraFim: Date;
    status: StatusReserva;
  };
  veiculo: {
    marca: string;
    modelo: string;
  };
  retirada: CompartilhamentoLocalPublico | null;
  devolucao: CompartilhamentoLocalPublico | null;
}

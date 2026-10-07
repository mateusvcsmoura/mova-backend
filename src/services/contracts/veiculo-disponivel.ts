export interface VeiculoDisponivelPayload {
  veiculo: {
    marca: string;
    modelo: string;
    ano: number;
    placa: string;
  };
  locador: {
    empresa: string;
  };
  // Garagem onde o veículo está disponível (null se desvinculado).
  garagem: {
    nome: string;
    endereco: string;
  } | null;
  locatario: {
    nome: string;
    email: string;
  };
}

// Conteúdo pronto para envio, gerado a partir do payload.
export interface VeiculoDisponivelContent {
  subject: string;
  html: string;
  text: string;
}

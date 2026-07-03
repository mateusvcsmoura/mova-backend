// Payload da notificação de veículo disponível. Estrutura intermediária,
// independente do canal de saída (e-mail hoje; push/SMS/WhatsApp no futuro) e
// das entidades do Prisma. O dispatcher monta este payload; os templates de
// cada canal apenas o consomem.
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

export interface CreateAvaliacaoRequest {
  idReserva: string;
  nota: number;
  comentario?: string;
}

export interface AvaliacaoResponse {
  id: string;
  idReserva: string;
  // Prisma.Decimal -> number para a resposta da API
  nota: number;
  comentario: string | null;
  data: Date;
  atualizadoEm: Date;
}

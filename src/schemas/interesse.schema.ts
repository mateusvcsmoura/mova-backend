import { z } from "zod";

export const createInteresseSchema = z.object({
  idVeiculo: z.string().uuid(),
});

// Parâmetro de rota :id_veiculo (cancelamento de inscrição).
export const interesseVeiculoParamSchema = z.string().uuid();

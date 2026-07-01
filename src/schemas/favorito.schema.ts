import { z } from "zod";

export const createFavoritoSchema = z.object({
  idVeiculo: z.string().uuid(),
});

// Parâmetro de rota :id_veiculo (remoção e verificação de favorito).
export const favoritoVeiculoParamSchema = z.string().uuid();

import { z } from "zod";

export const createAvaliacaoSchema = z.object({
  idReserva: z.string().uuid(),

  nota: z
    .number()
    .min(1, "A nota mínima é 1")
    .max(5, "A nota máxima é 5"),

  comentario: z.string().max(255).optional(),
});

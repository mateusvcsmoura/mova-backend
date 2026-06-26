import { z } from "zod";

export const createAvaliacaoSchema = z.object({
  idReserva: z.string().uuid(),

  // Escala 1..5. A model usa Decimal(2,1), portanto notas com uma casa
  // decimal (ex.: 4.5) são permitidas — comportamento preservado.
  nota: z
    .number()
    .min(1, "A nota mínima é 1")
    .max(5, "A nota máxima é 5"),

  comentario: z.string().max(255).optional(),
});

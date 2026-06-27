import { z } from "zod";
import { MotivoBloqueio } from "@prisma/client";

export const motivoBloqueioSchema = z.nativeEnum(MotivoBloqueio);

export const createBloqueioSchema = z.object({
  idLocatario: z.string().uuid(),
  motivo: z.nativeEnum(MotivoBloqueio),
  descricao: z.string().min(2).max(255).optional(),
  // Ausente => bloqueio permanente. Quando informado, deve estar no futuro.
  expiraEm: z.coerce
    .date()
    .refine((d) => d > new Date(), {
      message: "A data de expiração deve estar no futuro.",
    })
    .optional(),
});

// Query da listagem do histórico (GET .../locatario/:idLocatario?ativos=true).
export const bloqueioQuerySchema = z.object({
  ativos: z.coerce.boolean().optional(),
});

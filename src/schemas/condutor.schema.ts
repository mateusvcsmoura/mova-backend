import { z } from "zod";

// Condutor adicional (RF12). idReserva vem do parâmetro de rota, não do body.
export const createCondutorSchema = z.object({
  nome: z.string().min(2).max(255),
  cpf: z
    .string()
    .regex(/^\d{11}$/, "CPF deve conter exatamente 11 números")
    .optional(),
  cnh: z.string().regex(/^\d{11}$/, "CNH deve conter exatamente 11 números"),
});

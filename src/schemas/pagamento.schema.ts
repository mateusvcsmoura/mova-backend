import { z } from "zod";
import { MetodoPagamento } from "@prisma/client";

// Dados de teste do cartão. Nada aqui é persistido: servem apenas para o
// sandbox decidir o desfecho (ver src/infra/payment/sandbox.ts).
const cartaoSandboxSchema = z.object({
  numero: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s|-/g, ""))
    .refine((v) => /^\d{13,19}$/.test(v), "Número de cartão inválido."),
  nome: z.string().trim().min(2).max(255),
  validade: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Validade deve estar no formato MM/AA"),
  cvv: z.string().trim().regex(/^\d{3,4}$/, "CVV inválido"),
});

/**
 * Corpo de POST /api/reserva/:id/pagamento.
 *
 * Note o que NÃO existe aqui: nenhum campo de status, nenhum de valor. O
 * desfecho é decidido pelo backend e o valor vem da reserva.
 */
export const iniciarPagamentoSchema = z.object({
  metodoPagamento: z.nativeEnum(MetodoPagamento),
  cartao: cartaoSandboxSchema.optional(),
});

import { z } from "zod";

enum Cargo {
  LOCATARIO = "LOCATARIO",
  LOCADOR = "LOCADOR",
  ADMIN = "ADMIN",
}

// Política de senha robusta: mín. 8 caracteres com minúscula, maiúscula,
// número e caractere especial.
const senhaForteSchema = z
  .string()
  .min(8, "Senha deve ter no mínimo 8 caracteres")
  .max(100)
  .regex(/[a-z]/, "Senha deve conter ao menos uma letra minúscula")
  .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiúscula")
  .regex(/[0-9]/, "Senha deve conter ao menos um número")
  .regex(/[^A-Za-z0-9]/, "Senha deve conter ao menos um caractere especial");

export const createContaSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(255),

  email: z.string().email("Email inválido").max(255),

  telefone: z
    .string()
    .regex(/^\d{10,15}$/, "Telefone deve ter entre 10 e 15 números")
    .optional(),

  senha: senhaForteSchema,

  cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP deve estar no formato 12345-678 ou 12345678"),
  endereco: z.string().min(3, "Endereço deve ter no mínimo 3 caracteres").max(255),
  cargo: z.nativeEnum(Cargo, {
    message: "Cargo deve ser LOCATARIO, LOCADOR ou ADMIN",
  }),
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido").max(255),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(100),
});

export const changePasswordSchema = z.object({
  senhaAtual: z.string(),
  novaSenha: senhaForteSchema,
});

export const updateContaSchema = z
  .object({
    nome: z.string().min(3).max(255).optional(),

    email: z.string().email().max(255).optional(),

    telefone: z
      .string()
      .regex(/^\d{10,15}$/, "Telefone deve ter entre 10 e 15 números")
      .optional(),
    cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP deve estar no formato 12345-678 ou 12345678").optional(),
    endereco: z.string().min(3, "Endereço deve ter no mínimo 3 caracteres").max(255).optional(),
    cargo: z.nativeEnum(Cargo, {
      message: "Cargo deve ser LOCATARIO, LOCADOR ou ADMIN",
    }).optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Envie pelo menos um campo para atualização",
  );

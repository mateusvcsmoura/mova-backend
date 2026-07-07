import { z } from "zod";
import { CanalNotificacao, TipoNotificacao } from "@prisma/client";

export const definirPreferenciaSchema = z.object({
  canal: z.nativeEnum(CanalNotificacao),
  tipo: z.nativeEnum(TipoNotificacao),
  habilitado: z.boolean(),
});

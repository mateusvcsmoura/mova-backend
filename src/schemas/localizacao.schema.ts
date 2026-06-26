import { z } from "zod";

export const createLocalizacaoSchema = z.object({
  idVeiculo: z.string().uuid(),

  latitude: z
    .number()
    .min(-90, "Latitude deve estar entre -90 e 90")
    .max(90, "Latitude deve estar entre -90 e 90"),

  longitude: z
    .number()
    .min(-180, "Longitude deve estar entre -180 e 180")
    .max(180, "Longitude deve estar entre -180 e 180"),

  // Instante do evento. Quando omitido, o banco usa @default(now()).
  dataHora: z.coerce.date().optional(),
});

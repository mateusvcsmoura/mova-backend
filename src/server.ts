import dotenv from "dotenv";
dotenv.config();

import { app } from "./app.js";
import { localizacaoSimulador } from "./routes/container.js";

const PORT = Number(process.env.SERVER_PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);

  // Simulador de rastreador GPS: opt-in via env, nunca em ambiente de teste.
  if (
    process.env.LOCALIZACAO_SIMULADOR === "true" &&
    process.env.NODE_ENV !== "test"
  ) {
    localizacaoSimulador.start();
  }
});

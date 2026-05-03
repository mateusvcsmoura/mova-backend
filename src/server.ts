import dotenv from "dotenv";
dotenv.config();

import { app } from "./app.js";

const PORT = Number(process.env.SERVER_PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

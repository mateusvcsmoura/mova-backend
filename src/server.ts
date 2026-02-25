import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { testConnection } from "./database/utils/connectionTest.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { basicRouter } from "./routes/basic/basic.js";
import { contaRouter } from "./routes/conta/conta.js";
import { deficienciaRouter } from "./routes/deficiencia/deficiencia.js";
import { locadorRouter } from "./routes/locador/locador.js";

const PORT = Number(process.env.SERVER_PORT);
const app = express();

app.use(express.json());

app.use("/api/basic", basicRouter);
app.use("/api/conta", contaRouter);
app.use("/api/deficiencia", deficienciaRouter);
app.use("/api/locador", locadorRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  testConnection();
});

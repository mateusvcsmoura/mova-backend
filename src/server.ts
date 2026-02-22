import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { testConnection } from "./database/utils/connectionTest.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { basicRouter } from "./routes/basic/basic.js";
import { contaRouter } from "./routes/conta/conta.js";

const PORT = Number(process.env.SERVER_PORT);
const app = express();

app.use(express.json());
app.use(errorHandler);

app.use("/basic", basicRouter);
app.use("/conta", contaRouter);

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  testConnection();
});

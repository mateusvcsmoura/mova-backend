import express from "express";
import cors from "cors";
import { errorHandler } from "./middlewares/error-handler.js";
import { basicRouter } from "./routes/basic/basic.js";
import { contaRouter } from "./routes/conta/conta.js";
import { locadorRouter } from "./routes/locador/locador.js";
import { locatarioRouter } from "./routes/locatario/locatario.js";
import { veiculoRouter } from "./routes/veiculo/veiculo.js";
import { apiMetadata } from "./middlewares/api-version.js";
import { adminRouter } from "./routes/admin/admin.js";
import { deficienciaRouter } from "./routes/deficiencia/deficiencia.js";
import { garagemRouter } from "./routes/garagem/garagem.js";
import { reservaRouter } from "./routes/reserva/reserva.js";
import { servicoOpcionalRouter } from "./routes/servico-opcional/servico-opcional.js";
import { localizacaoRouter } from "./routes/localizacao/localizacao.js";
import { avaliacaoRouter } from "./routes/avaliacao/avaliacao.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use(apiMetadata("v1.0.0"));

app.use("/api/basic", basicRouter);
app.use("/api/admin", adminRouter);
app.use("/api/deficiencia", deficienciaRouter);
app.use("/api/conta", contaRouter);
app.use("/api/locador", locadorRouter);
app.use("/api/locatario", locatarioRouter);
app.use("/api/veiculo", veiculoRouter);
app.use("/api/garagem", garagemRouter);
app.use("/api/reserva", reservaRouter);
app.use("/api/servico", servicoOpcionalRouter);
app.use("/api/localizacao", localizacaoRouter);
app.use("/api/avaliacao", avaliacaoRouter);

app.use(errorHandler);

export { app };

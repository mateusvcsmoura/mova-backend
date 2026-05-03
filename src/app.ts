import express from "express";
import { errorHandler } from "./middlewares/error-handler.js";
import { basicRouter } from "./routes/basic/basic.js";
import { contaRouter } from "./routes/conta/conta.js";
import { locadorRouter } from "./routes/locador/locador.js";
import { locatarioRouter } from "./routes/locatario/locatario.js";
import { veiculoRouter } from "./routes/veiculo/veiculo.js";
import { apiMetadata } from "./middlewares/api-version.js";
import { adminRouter } from "./routes/admin/admin.js";

const app = express();

app.use(express.json());

app.use(apiMetadata("v1.0.0"));

app.use("/api/basic", basicRouter);
app.use("/api/admin", adminRouter);
app.use("/api/conta", contaRouter);
app.use("/api/locador", locadorRouter);
app.use("/api/locatario", locatarioRouter);
app.use("/api/veiculo", veiculoRouter);

app.use(errorHandler);

export { app };

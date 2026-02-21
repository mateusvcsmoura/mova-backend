import express from "express";
import { testConnection } from "./database/utils/connectionTest.js";

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  return res.json({ message: "API online" });
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  testConnection();
});


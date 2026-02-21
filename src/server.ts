import dotenv from 'dotenv';
dotenv.config();
import express from "express";
import { testConnection } from "./database/utils/connectionTest.js";

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  return res.json({ message: "API online" });
});

const PORT = Number(process.env.SERVER_PORT);

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  testConnection();
});


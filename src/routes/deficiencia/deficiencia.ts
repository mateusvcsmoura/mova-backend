import { Router } from "express";
import { DeficienciaRepository } from "../../repositories/deficiencia.repository.js";

const deficienciaRouter = Router();
const deficienciaRepository = new DeficienciaRepository();

deficienciaRouter.get("/all", async (req, res) => {
  const result = await deficienciaRepository.findAll();

  return res.json({ result });
});

deficienciaRouter.post("/create", async (req, res) => {
  const { descricao } = req.body;
  const result = await deficienciaRepository.create({ descricao });

  return res.json({ result });
});

export { deficienciaRouter };

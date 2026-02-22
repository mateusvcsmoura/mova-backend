import { Router } from "express";
import { ContaRepository } from "../../repositories/conta.repository.js";

const contaRouter = Router();
const contaRepository = new ContaRepository();

contaRouter.get("/all", async (req, res) => {
  const result = await contaRepository.findAll();
  return res.json({ result });
});

export { contaRouter };

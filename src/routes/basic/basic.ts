import { Router } from "express";
import { ContaRepository } from "../../repositories/conta.repository.js";

const basicRouter = Router();

basicRouter.get("/", (req, res) => {
  return res.json({ message: "API online" });
});

basicRouter.get("/testUser", async (req, res) => {
  const contaRepo = new ContaRepository();
  const result = await contaRepo.findByEmail('lee.chaeryeong@kr.com')
  return res.json({ result });
});

export { basicRouter };


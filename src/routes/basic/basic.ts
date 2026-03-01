import { Router } from "express";

const basicRouter = Router();

basicRouter.get("/status", (req, res) => {
  return res.json({ message: "API online" });
});

export { basicRouter };

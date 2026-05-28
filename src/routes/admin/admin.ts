import { Router } from "express";
import { contaController } from "../container.js";

const adminRouter = Router();

// CONTA
adminRouter.get("/conta/all", contaController.index);
adminRouter.get("/conta/", contaController.findByEmail);
adminRouter.get("/conta/:id", contaController.findById);
adminRouter.post("/conta/create", contaController.create);
adminRouter.put("/conta/update/:id", contaController.update);
adminRouter.delete("/conta/delete/:id", contaController.delete);

export { adminRouter };

import { Router } from "express";
import { contaController, deficienciaController } from "../container.js";

const adminRouter = Router();

// CONTA
adminRouter.get("/conta/all", contaController.index);
adminRouter.get("/conta/", contaController.findByEmail);
adminRouter.get("/conta/:id", contaController.findById);
adminRouter.post("/conta/create", contaController.create);
adminRouter.put("/conta/update/:id", contaController.update);
adminRouter.delete("/conta/delete/:id", contaController.delete);

// DEFICIENCIA
adminRouter.get("/deficiencia/all", deficienciaController.index);
adminRouter.get("/deficiencia/search", deficienciaController.findByDescription);
adminRouter.post("/deficiencia", deficienciaController.create);
adminRouter.get("/deficiencia/:id", deficienciaController.findById);
adminRouter.put("/deficiencia/:id", deficienciaController.update);
adminRouter.delete("/deficiencia/:id", deficienciaController.delete);

export { adminRouter };

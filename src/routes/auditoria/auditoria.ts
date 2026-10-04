import { Cargo, EntidadeAuditada } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { authMiddleware, AuthRequest } from "../../middlewares/auth-middleware.js";
import { authorize } from "../../middlewares/authorization-middleware.js";
import { AuditoriaService } from "../../services/auditoria.js";
import { getPaginationParams, toPaginationMeta } from "../../shared/pagination.js";

const auditoriaService = new AuditoriaService();
const filtrosSchema = z.object({
  entidade: z.nativeEnum(EntidadeAuditada).optional(),
  idEntidade: z.string().uuid().optional(),
});

const auditoriaRouter = Router();

// RN09: somente leitura. Sem PUT/PATCH/DELETE — a trilha é append-only.
auditoriaRouter.get("/", authMiddleware, authorize(Cargo.LOCADOR, Cargo.ADMIN), async (req: AuthRequest, res, next) => {
  try {
    const filtros = filtrosSchema.parse({ entidade: req.query.entidade, idEntidade: req.query.idEntidade });
    const resultado = await auditoriaService.listar(filtros, req.user!, getPaginationParams(req.query));
    res.json({ result: resultado.data, pagination: toPaginationMeta(resultado) });
  } catch (error) {
    next(error);
  }
});

export { auditoriaRouter };

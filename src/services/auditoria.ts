import { Cargo, EntidadeAuditada } from "@prisma/client";

import { prisma } from "../database/prisma.js";
import { buildPaginatedResult, PaginationParams, toSkipTake } from "../shared/pagination.js";

// RN09 — consulta SOMENTE LEITURA da trilha de auditoria. Não existe caminho de
// edição/exclusão na aplicação (e o banco recusa UPDATE/DELETE por gatilho).
export class AuditoriaService {
  listar = async (
    filtros: { entidade?: EntidadeAuditada; idEntidade?: string },
    requester: { id: string; cargo: Cargo },
    pagination: PaginationParams,
  ) => {
    // LOCADOR só enxerga registros dos próprios recursos; ADMIN vê todos.
    const where = {
      ...(requester.cargo === Cargo.ADMIN ? {} : { idLocador: requester.id }),
      ...(filtros.entidade ? { entidade: filtros.entidade } : {}),
      ...(filtros.idEntidade ? { idEntidade: filtros.idEntidade } : {}),
    };
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await prisma.$transaction([
      prisma.registroAuditoria.findMany({ where, skip, take, orderBy: { criadoEm: "desc" } }),
      prisma.registroAuditoria.count({ where }),
    ]);
    return buildPaginatedResult(data, total, pagination);
  };
}

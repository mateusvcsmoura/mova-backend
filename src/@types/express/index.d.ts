import { Cargo } from "@prisma/client";
import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        cargo: Cargo;
      };
      // Correlação de requisição (observabilidade). Definido pelo middleware
      // observability a partir do header X-Request-Id ou de um UUID gerado.
      id?: string;
    }
  }
}

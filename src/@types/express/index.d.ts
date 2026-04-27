import { Cargo } from "@prisma/client";
import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        cargo: Cargo;
      };
    }
  }
}

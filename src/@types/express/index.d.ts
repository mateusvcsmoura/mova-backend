import { Cargo } from "@prisma/client";
import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        cargo: Cargo;
      };
      id?: string;
      locale?: import("../../i18n/index.js").Locale;
    }
  }
}

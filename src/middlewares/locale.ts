import { RequestHandler } from "express";

import { resolveLocale } from "../i18n/index.js";

// Resolve o idioma da requisição a partir do header Accept-Language e o
// disponibiliza em req.locale (padrão "pt"). Usado pelo error-handler e pelos
// fluxos que produzem texto ao usuário (ex.: e-mails).
export const localeMiddleware: RequestHandler = (req, _res, next) => {
  req.locale = resolveLocale(req.headers["accept-language"]);
  next();
};

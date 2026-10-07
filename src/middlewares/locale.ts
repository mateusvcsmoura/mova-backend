import { RequestHandler } from "express";

import { resolveLocale } from "../i18n/index.js";

export const localeMiddleware: RequestHandler = (req, _res, next) => {
  req.locale = resolveLocale(req.headers["accept-language"]);
  next();
};

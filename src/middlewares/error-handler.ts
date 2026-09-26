import { randomUUID } from "node:crypto";
import { ErrorRequestHandler } from "express";
import z from "zod";
import { HttpError } from "../errors/HttpError.js";
import { ErrorCode, LOCALE_PADRAO, traduzirErro } from "../i18n/index.js";
import { logger } from "../shared/logger.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
    const locale = req.locale ?? LOCALE_PADRAO;
    const requestId = req.id ?? randomUUID();
    res.setHeader("X-Request-Id", requestId);

    if (error instanceof HttpError) {
        const traduzida =
            locale === LOCALE_PADRAO ? undefined : traduzirErro(error.code, locale);
        return res.status(error.status).json({
            code: error.code ?? "BUSINESS_ERROR",
            message: traduzida ?? error.message,
            requestId,
        });
    }

    if (error instanceof z.ZodError) {
        const traduzida =
            locale === LOCALE_PADRAO
                ? "Invalid Data Format"
                : traduzirErro(ErrorCode.VALIDATION_ERROR, locale) ??
                  "Invalid Data Format";
        return res.status(400).json({
            code: ErrorCode.VALIDATION_ERROR,
            message: traduzida,
            errors: error.issues.map(({ path, message }) => ({ path, message })),
            requestId,
        });
    }

    // Never log the original error: messages and stacks may contain secrets.
    logger.error("unhandled request error", {
        requestId,
        errorType: error instanceof Error ? "Error" : typeof error,
    });
    const internaTraduzida =
        locale === LOCALE_PADRAO
            ? "Internal Server Error"
            : traduzirErro(ErrorCode.INTERNAL_ERROR, locale) ??
              "Internal Server Error";
    return res.status(500).json({
        code: ErrorCode.INTERNAL_ERROR,
        message: internaTraduzida,
        requestId,
    });
};

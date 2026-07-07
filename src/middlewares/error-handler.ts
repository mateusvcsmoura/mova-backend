import { ErrorRequestHandler } from "express";
import z from "zod";
import { HttpError } from "../errors/HttpError.js";
import { ErrorCode, LOCALE_PADRAO, traduzirErro } from "../i18n/index.js";

export const errorHandler: ErrorRequestHandler = (e, req, res, next) => {
    const locale = req.locale ?? LOCALE_PADRAO;

    // Erros de negócio (HttpError) e de validação (Zod) têm mensagens seguras,
    // pensadas para o cliente — podem ser devolvidas.
    if (e instanceof HttpError) {
        // Em pt mantemos a mensagem original (compatibilidade); em outros
        // idiomas, se houver código catalogado, traduzimos. Sem código/tradução,
        // devolve a mensagem original.
        const traduzida =
            locale === LOCALE_PADRAO ? undefined : traduzirErro(e.code, locale);
        return res.status(e.status).json({
            ...(e.code ? { code: e.code } : {}),
            message: traduzida ?? e.message,
        });
    } else if (e instanceof z.ZodError) {
        const traduzida =
            locale === LOCALE_PADRAO
                ? "Invalid Data Format"
                : traduzirErro(ErrorCode.VALIDATION_ERROR, locale) ??
                  "Invalid Data Format";
        return res.status(400).json({
            code: ErrorCode.VALIDATION_ERROR,
            message: traduzida,
            errors: e.issues,
        });
    }

    // Erro interno não tratado: NUNCA expor a mensagem original ao cliente
    // (pode vazar detalhes de implementação/infra). Registra nos logs internos
    // e devolve uma mensagem genérica.
    console.error("[error-handler] erro interno não tratado:", e);
    const internaTraduzida =
        locale === LOCALE_PADRAO
            ? "Internal Server Error"
            : traduzirErro(ErrorCode.INTERNAL_ERROR, locale) ??
              "Internal Server Error";
    return res
        .status(500)
        .json({ code: ErrorCode.INTERNAL_ERROR, message: internaTraduzida });
};
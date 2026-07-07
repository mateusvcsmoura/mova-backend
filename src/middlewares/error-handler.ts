import { ErrorRequestHandler } from "express";
import z from "zod";
import { HttpError } from "../errors/HttpError.js";

export const errorHandler: ErrorRequestHandler = (e, req, res, next) => {
    // Erros de negócio (HttpError) e de validação (Zod) têm mensagens seguras,
    // pensadas para o cliente — podem ser devolvidas.
    if (e instanceof HttpError) {
        return res.status(e.status).json({ message: e.message });
    } else if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid Data Format", errors: e.issues });
    }

    // Erro interno não tratado: NUNCA expor a mensagem original ao cliente
    // (pode vazar detalhes de implementação/infra). Registra nos logs internos
    // e devolve uma mensagem genérica.
    console.error("[error-handler] erro interno não tratado:", e);
    return res.status(500).json({ message: "Internal Server Error" });
};
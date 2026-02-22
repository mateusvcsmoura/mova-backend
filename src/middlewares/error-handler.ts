import { ErrorRequestHandler } from "express";
import z from "zod";
import { HttpError } from "../errors/HttpError.js";

export const errorHandler: ErrorRequestHandler = (e, req, res, next) => {
    if (e instanceof HttpError) {
        return res.status(e.status).json({ message: e.message });
    } else if (e instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid Data Format", errors: e.issues });
    } else if (e instanceof Error) {
        return res.status(500).json({ message: e.message });
    } else {
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
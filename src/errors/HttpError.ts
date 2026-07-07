class HttpError extends Error {
    status: number;
    // Código de erro estável (i18n). Opcional: quando presente, o error-handler
    // pode traduzir a mensagem por idioma. A mensagem (em pt) segue no `message`.
    code?: string;

    constructor(status: number, message: string, code?: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
};

export { HttpError };
CREATE TABLE IF NOT EXISTS Conta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    telefone VARCHAR(20),
    senha_hash VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS Locatario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cpf VARCHAR(14) UNIQUE NOT NULL,
    cnh VARCHAR(20) UNIQUE NOT NULL,
    CONSTRAINT fk_locatario_conta
        FOREIGN KEY (id)
        REFERENCES Conta(id)
        ON DELETE CASCADE,
    deficiencia_id UUID,
    CONSTRAINT fk_deficiencia
        FOREIGN KEY (deficiencia_id)
        REFERENCES Deficiencia(id)
);

CREATE TABLE IF NOT EXISTS Locador (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) NOT NULL,
    CONSTRAINT fk_locador_conta
        FOREIGN KEY (id)
        REFERENCES Conta(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Deficiencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    descricao VARCHAR(255) NOT NULL
);

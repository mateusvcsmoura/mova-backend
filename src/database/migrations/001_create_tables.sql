CREATE TABLE IF NOT EXISTS Conta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    telefone VARCHAR(15),
    senha_hash VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS Deficiencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    descricao VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS Locatario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cpf VARCHAR(11) UNIQUE NOT NULL,
    cnh VARCHAR(11) UNIQUE NOT NULL,
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
    cnpj VARCHAR(14) UNIQUE NOT NULL,
    CONSTRAINT fk_locador_conta
        FOREIGN KEY (id)
        REFERENCES Conta(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Veiculo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_locador UUID NOT NULL,
    CONSTRAINT fk_locador
        FOREIGN KEY (id_locador)
        REFERENCES Locador(id)
        ON DELETE CASCADE,
    placa VARCHAR(8) UNIQUE NOT NULL,
    marca VARCHAR(255) NOT NULL,
    modelo VARCHAR(255) NOT NULL,
    ano SMALLINT NOT NULL CHECK (ano BETWEEN 1900 AND 2100),
    cambio VARCHAR(255) NOT NULL,
    capacidade SMALLINT NOT NULL CHECK (capacidade > 0),
    status VARCHAR(255) NOT NULL,
    eletrico BOOLEAN NOT NULL,
    adaptado BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS Garagem (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_locador UUID NOT NULL,
    CONSTRAINT fk_locador
        FOREIGN KEY (id_locador)
        REFERENCES Locador(id)
        ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    endereco VARCHAR(255) NOT NULL,
    capacidade SMALLINT NOT NULL CHECK (capacidade > 0),
    veiculos_alocados SMALLINT NOT NULL,
    acessibilidade BOOLEAN NOT NULL DEFAULT TRUE
);


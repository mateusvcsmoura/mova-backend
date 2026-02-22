CREATE TABLE IF NOT EXISTS Conta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    telefone VARCHAR(15),
    senha_hash VARCHAR(255) NOT NULL,
    criada_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    CONSTRAINT fk_locatario_deficiencia
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
    CONSTRAINT fk_veiculo_locador
        FOREIGN KEY (id_locador)
        REFERENCES Locador(id)
        ON DELETE CASCADE,
    placa VARCHAR(8) UNIQUE NOT NULL,
    marca VARCHAR(255) NOT NULL,
    modelo VARCHAR(255) NOT NULL,
    ano SMALLINT NOT NULL CHECK (ano BETWEEN 1900 AND 2100),
    cambio VARCHAR(255) NOT NULL,
    capacidade SMALLINT NOT NULL CHECK (capacidade > 0),
    status status_veiculo NOT NULL DEFAULT 'disponivel',
    eletrico BOOLEAN NOT NULL,
    adaptado BOOLEAN NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Garagem (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_locador UUID NOT NULL,
    CONSTRAINT fk_garagem_locador
        FOREIGN KEY (id_locador)
        REFERENCES Locador(id)
        ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    endereco VARCHAR(255) NOT NULL,
    capacidade SMALLINT NOT NULL CHECK (capacidade > 0),
    veiculos_alocados SMALLINT NOT NULL,
    acessibilidade BOOLEAN NOT NULL DEFAULT TRUE,
    criada_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Reserva (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_veiculo UUID NOT NULL,
    CONSTRAINT fk_reserva_veiculo
        FOREIGN KEY (id_veiculo)
        REFERENCES Veiculo(id),
    id_locatario UUID NOT NULL,
    CONSTRAINT fk_reserva_locatario
        FOREIGN KEY (id_locatario)
        REFERENCES Locatario(id),
    data_hora_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_hora_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    criada_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valor_total DECIMAL(10, 2) NOT NULL,
    status status_reserva NOT NULL DEFAULT 'aguardando pagamento',
    status_pagamento status_pagamento NOT NULL DEFAULT 'aguardando pagamento',

    CONSTRAINT chk_periodo_reserva
        CHECK (data_hora_fim > data_hora_inicio)
);

CREATE TABLE IF NOT EXISTS Localizacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_veiculo UUID NOT NULL,
    CONSTRAINT fk_localizacao_veiculo
        FOREIGN KEY (id_veiculo)
        REFERENCES Veiculo(id)
        ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(10, 8) NOT NULL,
    data_hora TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Avaliacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_reserva UUID NOT NULL,
    CONSTRAINT fk_avaliacao_reserva
        FOREIGN KEY (id_reserva)
        REFERENCES Reserva(id)
        ON DELETE CASCADE,
    comentario TEXT,
    data DATE DEFAULT CURRENT_DATE,
    nota DECIMAL(2,1) CHECK (nota BETWEEN 0 AND 5)
);


CREATE TYPE status_veiculo AS ENUM (
    'disponivel',
    'reservado',
    'manutencao',
    'inativo'
);

CREATE TYPE status_reserva AS ENUM (
    'aguardando pagamento',
    'confirmada',
    'em andamento',
    'realizada',
    'cancelada'
);

CREATE TYPE status_pagamento AS ENUM (
    'aguardando pagamento',
    'processando',
    'sucesso',
    'falha'
);


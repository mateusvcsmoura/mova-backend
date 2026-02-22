CREATE INDEX IF NOT EXISTS idx_reserva_veiculo ON Reserva(id_veiculo);
CREATE INDEX IF NOT EXISTS idx_reserva_locatario ON Reserva(id_locatario);
CREATE INDEX IF NOT EXISTS idx_veiculo_locador ON Veiculo(id_locador);


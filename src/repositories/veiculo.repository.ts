import { pool } from "../database/pool.js";
import { VeiculoResponse } from "./contracts/veiculo.contract.js";

export class VeiculoRepository {
  async findAll(): Promise<VeiculoResponse[]> {
    const result = await pool.query("SELECT * FROM public.veiculo");

    return result.rows;
  }

  async findByLocadorId(id_locador: string): Promise<VeiculoResponse[]> {
    const result = await pool.query(
      "SELECT * FROM public.veiculo WHERE id_locador = $1",
      [id_locador],
    );

    return result.rows;
  }

  async findById(id: string): Promise<VeiculoResponse> {
    const result = await pool.query(
      "SELECT * FROM public.veiculo WHERE id = $1",
      [id],
    );

    return result.rows[0];
  }

  async findByPlaca(placa: string): Promise<VeiculoResponse> {
    const result = await pool.query(
      "SELECT * FROM public.veiculo WHERE placa = $1",
      [placa],
    );

    return result.rows[0];
  }

  async findByMarca(marca: string): Promise<VeiculoResponse[]> {
    const result = await pool.query(
      "SELECT * FROM public.veiculo WHERE marca = $1",
      [marca],
    );

    return result.rows;
  }

  async findByModelo(modelo: string): Promise<VeiculoResponse[]> {
    const result = await pool.query(
      "SELECT * FROM public.veiculo WHERE modelo = $1",
      [modelo],
    );

    return result.rows;
  }

  async findByAno(ano: number): Promise<VeiculoResponse[]> {
    const result = await pool.query(
      "SELECT * FROM public.veiculo WHERE ano = $1",
      [ano],
    );

    return result.rows;
  }

  async findByCambio(cambio: string): Promise<VeiculoResponse[]> {
    const result = await pool.query(
      "SELECT * FROM public.veiculo WHERE cambio = $1",
      [cambio],
    );

    return result.rows;
  }

  async findByCapacidade(capacidade: number): Promise<VeiculoResponse[]> {
    const result = await pool.query(
      "SELECT * FROM public.veiculo WHERE capacidade = $1",
      [capacidade],
    );

    return result.rows;
  }

  async findByStatus(status: string): Promise<VeiculoResponse[]> {
    const result = await pool.query(
      "SELECT * FROM public.veiculo WHERE status = $1",
      [status],
    );

    return result.rows;
  }

  async findByEletrico(eletrico: boolean): Promise<VeiculoResponse[]> {
    const result = await pool.query(
      "SELECT * FROM public.veiculo WHERE eletrico = $1",
      [eletrico],
    );

    return result.rows;
  }

  async findByAdaptado(adaptado: boolean): Promise<VeiculoResponse[]> {
    const result = await pool.query(
      "SELECT * FROM public.veiculo WHERE adaptado = $1",
      [adaptado],
    );

    return result.rows;
  }
}

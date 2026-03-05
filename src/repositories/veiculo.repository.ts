import { pool } from "../database/pool.js";
import { HttpError } from "../errors/HttpError.js";
import {
  CreateVeiculoRequest,
  UpdateVeiculoRequest,
  VeiculoFilters,
  VeiculoResponse,
} from "./contracts/veiculo.contract.js";

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

  async search(filters: VeiculoFilters): Promise<VeiculoResponse[]> {
    const entries = Object.entries(filters).filter(
      ([_, value]) => value !== undefined,
    );

    if (entries.length === 0) {
      const result = await pool.query("SELECT * FROM public.veiculo");
      return result.rows;
    }

    const whereClause = entries
      .map(([key], index) => `${key} = $${index + 1}`)
      .join(" AND ");

    const values = entries.map(([_, value]) => value);

    const query = `
    SELECT * FROM public.veiculo
    WHERE ${whereClause}
  `;

    const result = await pool.query(query, values);

    return result.rows;
  }

  async create(data: CreateVeiculoRequest): Promise<VeiculoResponse> {
    const result = await pool.query(
      `INSERT INTO public.veiculo (id_locador, placa, marca, modelo, ano, cambio, capacidade, status, eletrico, adaptado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.id_locador,
        data.placa,
        data.marca,
        data.modelo,
        data.ano,
        data.cambio,
        data.capacidade,
        data.status,
        data.eletrico,
        data.adaptado,
      ],
    );

    return result.rows[0];
  }

  async update(
    id: string,
    data: UpdateVeiculoRequest,
  ): Promise<VeiculoResponse> {
    const fields = Object.entries(data).filter(
      ([_, value]) => value !== undefined,
    );

    if (fields.length === 0) {
      throw new HttpError(400, "Nenhum campo informado para atualização.");
    }

    const setClause = fields
      .map(([key], index) => `${key} = $${index + 1}`)
      .join(", ");

    const values = fields.map(([_, value]) => value);

    const query = `
    UPDATE public.veiculo
    SET ${setClause}
    WHERE id = $${fields.length + 1}
    RETURNING *
  `;

    const result = await pool.query(query, [...values, id]);

    if (result.rowCount === 0) {
      throw new HttpError(404, "Veículo não encontrado.");
    }

    return result.rows[0];
  }

  async delete(id: string): Promise<void> {
    await pool.query("DELETE FROM public.veiculo WHERE id = $1", [id]);
  }
}

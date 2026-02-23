import { pool } from "../database/pool.js";
import {
  CreateDeficienciaRequest,
  DeficienciaResponse,
  UpdateDeficienciaRequest,
} from "./contracts/deficiencia.contract.js";

export class DeficienciaRepository {
  async findAll(): Promise<DeficienciaResponse[]> {
    const result = await pool.query("SELECT * FROM public.deficiencia");

    return result.rows;
  }

  async findById(id: string): Promise<DeficienciaResponse | null> {
    const result = await pool.query(
      "SELECT * FROM public.deficiencia WHERE id = $1",
      [id],
    );

    return result.rows[0] || null;
  }

  async findByDescription(
    description: string,
  ): Promise<DeficienciaResponse | null> {
    const result = await pool.query(
      "SELECT * FROM public.deficiencia WHERE descricao = $1",
      [description],
    );

    return result.rows[0] || null;
  }

  async create(data: CreateDeficienciaRequest) {
    const result = await pool.query(
      `INSERT INTO public.deficiencia
                (descricao)
                VALUES ($1)
                RETURNING *`,
      [data.descricao],
    );

    return result.rows[0];
  }

  async update(id: string, data: UpdateDeficienciaRequest) {
    const result = await pool.query(
      `UPDATE public.deficiencia
     SET descricao = $1
     WHERE id = $2
     RETURNING *`,
      [data.descricao, id],
    );

    return result.rows[0] || null;
  }
}

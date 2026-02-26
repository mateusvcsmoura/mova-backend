import { pool } from "../database/pool.js";
import {
  CreateLocadorRequest,
  LocadorResponse,
  UpdateLocadorRequest,
} from "./contracts/locador.contract.js";

export class LocadorRepository {
  async findAll(): Promise<LocadorResponse[]> {
    const result = await pool.query("SELECT * FROM public.locador");

    return result.rows;
  }

  async findById(id: string): Promise<LocadorResponse> {
    const result = await pool.query(
      "SELECT * FROM public.locador WHERE id = $1",
      [id],
    );

    return result.rows[0] || null;
  }

  async findByCnpj(cnpj: string): Promise<LocadorResponse> {
    const result = await pool.query(
      "SELECT * FROM public.locador WHERE cnpj = $1",
      [cnpj],
    );

    return result.rows[0] || null;
  }

  async findByEmpresa(empresa: string): Promise<LocadorResponse[]> {
    const result = await pool.query(
      "SELECT * FROM public.locador WHERE empresa ILIKE $1",
      [`%${empresa}%`],
    );

    return result.rows[0] || null;
  }

  async create(data: CreateLocadorRequest): Promise<LocadorResponse> {
    const result = await pool.query(
      "INSERT INTO public.locador (id,empresa, cnpj) VALUES ($1, $2, $3) RETURNING *",
      [data.id, data.empresa, data.cnpj],
    );
    return result.rows[0];
  }

  async update(id: string, data: UpdateLocadorRequest) {
    const result = await pool.query(
      `UPDATE public.locador
     SET empresa = COALESCE($1, empresa),
         cnpj = COALESCE($2, cnpj)
     WHERE id = $3
     RETURNING *`,
      [data.empresa ?? null, data.cnpj ?? null, id],
    );

    return result.rows[0] || null;
  }

  async delete(id: string) {
    await pool.query("DELETE FROM public.locador WHERE id = $1", [id]);
  }
}

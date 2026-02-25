import { pool } from "../database/pool.js";
import {
  CreateLocadorRequest,
  LocadorResponse,
} from "./contracts/locador.contract.js";

export class LocadorRepository {
  async findAll(): Promise<LocadorResponse[]> {
    const result = await pool.query("SELECT * FROM public.locador");

    return result.rows;
  }

  async findById(id: number): Promise<LocadorResponse> {
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

  async findByName(nome: string): Promise<LocadorResponse[]> {
    const result = await pool.query(
      "SELECT * FROM public.locador WHERE nome ILIKE $1",
      [`%${nome}%`],
    );

    return result.rows[0] || null;
  }

  async create(locador: CreateLocadorRequest): Promise<LocadorResponse> {
    const result = await pool.query(
      "INSERT INTO public.locador (id,empresa, cnpj) VALUES ($1, $2, $3) RETURNING *",
      [locador.id, locador.empresa, locador.cnpj],
    );
    return result.rows[0];
  }
}

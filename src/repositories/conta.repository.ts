import { pool } from "../database/pool.js";
import {
  ContaResponse,
  CreateContaRequest,
  UpdateContaRequest,
} from "./contracts/conta.contract.js";

export class ContaRepository {
  async findAll(): Promise<ContaResponse[]> {
    const result = await pool.query(
      "SELECT id, nome, email, telefone, criada_em FROM public.conta",
    );

    return result.rows;
  }

  async findByEmail(email: string): Promise<ContaResponse | null> {
    const result = await pool.query(
      "SELECT id, nome, email, telefone, criada_em FROM public.conta WHERE email = $1",
      [email],
    );

    return result.rows[0] || null;
  }

  async findById(id: string): Promise<ContaResponse | null> {
    const result = await pool.query(
      "SELECT id, nome, email, telefone, criada_em FROM public.conta WHERE id = $1",
      [id],
    );

    return result.rows[0] || null;
  }

  async create(data: CreateContaRequest) {
    const result = await pool.query(
      `INSERT INTO public.conta
                (nome, email, telefone, senha_hash)
                VALUES ($1, $2, $3, $4)
                RETURNING id, nome, email, telefone, criada_em`,
      [data.nome, data.email, data.telefone ?? null, data.senha],
    );

    return result.rows[0];
  }

  async update(id: string, data: UpdateContaRequest) {
    const result = await pool.query(
      `UPDATE public.conta
     SET nome = COALESCE($1, nome),
         telefone = COALESCE($2, telefone)
     WHERE id = $3
     RETURNING id, nome, email, telefone, criada_em`,
      [data.nome ?? null, data.telefone ?? null, id],
    );

    return result.rows[0] || null;
  }

  async updatePassword(id: string, senha_hash: string) {
    await pool.query(
      `UPDATE public.conta
     SET senha_hash = $1
     WHERE id = $2`,
      [senha_hash, id],
    );
  }

  async delete(id: string) {
    await pool.query(`DELETE FROM public.conta WHERE id = $1`, [id]);
  }
}

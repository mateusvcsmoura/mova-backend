import { pool } from "../database/pool.js";
import {
  CreateLocatarioRequest,
  LocatarioResponse,
  UpdateLocatarioRequest,
} from "./contracts/locatario.contract.js";

export class LocatarioRepository {
  async findAll(): Promise<LocatarioResponse[]> {
    const result = await pool.query("SELECT * FROM public.locatario");

    return result.rows;
  }

  async findById(id: string): Promise<LocatarioResponse> {
    const result = await pool.query(
      "SELECT * FROM public.locatario WHERE id = $1",
      [id],
    );

    return result.rows[0] || null;
  }

  async findByCpf(cpf: string): Promise<LocatarioResponse> {
    const result = await pool.query(
      "SELECT * FROM public.locatario WHERE cpf = $1",
      [cpf],
    );

    return result.rows[0] || null;
  }

  async findByCnh(cnh: string): Promise<LocatarioResponse> {
    const result = await pool.query(
      "SELECT * FROM public.locatario WHERE cnh = $1",
      [cnh],
    );

    return result.rows[0] || null;
  }

  async create(data: CreateLocatarioRequest): Promise<LocatarioResponse> {
    const result = await pool.query(
      `INSERT INTO public.locatario 
     (id, cpf, cnh, deficiencia_id) 
     VALUES ($1, $2, $3, $4) 
     RETURNING *`,
      [data.id, data.cpf, data.cnh, data.deficiencia_id ?? null],
    );

    return result.rows[0];
  }

  async update(id: string, data: UpdateLocatarioRequest) {
    // esse metodo sera grande, porque tem que ser dinamico (inserir/remover deficiencia)

    const fields: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (data.cpf !== undefined) {
      fields.push(`cpf = $${index++}`);
      values.push(data.cpf);
    }

    if (data.cnh !== undefined) {
      fields.push(`cnh = $${index++}`);
      values.push(data.cnh);
    }

    if (data.deficiencia_id !== undefined && data.deficiencia_id !== null) {
      fields.push(`deficiencia_id = $${index++}`);
      values.push(data.deficiencia_id);
    }

    if (fields.length === 0) {
      throw new Error("Nenhum campo enviado para atualização.");
    }

    const query = `
    UPDATE public.locatario
    SET ${fields.join(", ")}
    WHERE id = $${index}
    RETURNING *
  `;

    values.push(id);

    const result = await pool.query(query, values);

    return result.rows[0];
  }

  async delete(id: string): Promise<void> {
    await pool.query("DELETE FROM public.locatario WHERE id = $1", [id]);
  }
}

import { pool } from '../pool.js';

export async function testConnection() {
  try {
    const result = await pool.query('SELECT 1');
    console.log('✅ Banco conectado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao conectar no banco:', error);
  }
}


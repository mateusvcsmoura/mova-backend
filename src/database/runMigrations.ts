import { readFileSync } from 'fs';
import { pool } from './connection.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  try {
    const sql = readFileSync(
      path.resolve(__dirname, 'migrations/001_create_tables.sql'),
      'utf-8'
    );

    await pool.query(sql);

    console.log('Migration executada com sucesso');
    process.exit(0);
  } catch (error) {
    console.error('Erro na migration:', error);
    process.exit(1);
  }
}

run();
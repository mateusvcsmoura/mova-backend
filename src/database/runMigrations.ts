import { readdirSync, readFileSync } from 'fs';
import { pool } from './connection.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  try {
    const migrationsPath = path.resolve(__dirname, 'migrations');

    const files = readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort(); // ordena para rodar por numero

    for (const file of files) {
      const sql = readFileSync(
        path.join(migrationsPath, file),
        'utf-8'
      );

      console.log(`Executando: ${file}`);
      await pool.query(sql);
    }

    console.log('Todas migrations executadas com sucesso');
    process.exit(0);
  } catch (error) {
    console.error('Erro nas migrations:', error);
    process.exit(1);
  }
}

run();
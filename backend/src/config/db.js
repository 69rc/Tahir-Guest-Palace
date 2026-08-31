import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'tahir_hotel',
  user: process.env.PGUSER || 'tahir',
  password: process.env.PGPASSWORD || 'tahir_hotel_dev_2026',
  max: 10,
  idleTimeoutMillis: 30000,
});

export default pool;

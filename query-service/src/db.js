const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { query };

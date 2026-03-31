const { Client } = require('pg');
const { readFileSync } = require('fs');
const { join } = require('path');

const RETRY_INTERVAL = 5000;
const MAX_RETRIES = 10;

async function initializeDatabase(retries = 0) {
  const client = new Client({
    user: process.env.DB_USER || 'user',
    host: process.env.DB_HOST || 'postgres',
    database: process.env.DB_NAME || 'onboarding',
    password: process.env.DB_PASSWORD || 'password',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  });

  try {
    await client.connect();
    const initSqlPath = join('/sql', 'init.sql');
    const initSql = readFileSync(initSqlPath, 'utf-8');
    await client.query(initSql);
    console.log('Database initialized successfully');
  } catch (err) {
    if (retries < MAX_RETRIES) {
      console.log(
        `Database not ready, retrying in ${RETRY_INTERVAL / 1000}s... (${retries + 1}/${MAX_RETRIES})`
      );
      await new Promise((r) => setTimeout(r, RETRY_INTERVAL));
      return initializeDatabase(retries + 1);
    }
    console.error('Failed to initialize database after maximum retries:', err.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

initializeDatabase();

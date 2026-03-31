const db = require('../db');

async function upsert(correlationId, data) {
  const result = await db.query(
    `INSERT INTO customers (correlation_id, account_no, first_name, last_name, email, address, notes, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (account_no) DO UPDATE SET
       correlation_id = EXCLUDED.correlation_id,
       first_name     = EXCLUDED.first_name,
       last_name      = EXCLUDED.last_name,
       email          = EXCLUDED.email,
       address        = EXCLUDED.address,
       notes          = EXCLUDED.notes,
       description    = EXCLUDED.description
     RETURNING id, xmax`,
    [correlationId, data.accountNo, data.firstName, data.lastName, data.email, data.address || null, data.notes || null, data.description || null]
  );
  const row = result.rows[0];
  const operation = parseInt(row.xmax) > 0 ? 'UPDATED' : 'INSERTED';
  return { id: row.id, operation };
}

module.exports = { upsert };

const express = require('express');
const db = require('../db');

const router = express.Router();

const QUERIES = {
  q1: {
    description: '10 most recently onboarded customers',
    sql: `SELECT id, correlation_id, account_no, first_name, last_name, email, address, notes, description, created_at
           FROM customers
           ORDER BY created_at DESC
           LIMIT 10`,
  },
  q2: {
    description: 'Customers with @gmail.com emails',
    sql: `SELECT id, correlation_id, account_no, first_name, last_name, email, address, notes, description, created_at
           FROM customers
           WHERE email LIKE '%@gmail.com'`,
  },
  q3: {
    description: 'Customer count per month in 2025',
    sql: `SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS customer_count
           FROM customers
           WHERE created_at >= '2025-01-01' AND created_at < '2026-01-01'
           GROUP BY DATE_TRUNC('month', created_at)
           ORDER BY month`,
  },
  q4: {
    description: 'Duplicate email addresses',
    sql: `SELECT email, COUNT(*) AS occurrences
           FROM customers
           GROUP BY email
           HAVING COUNT(*) > 1`,
  },
  q5: {
    description: 'Customers whose first name starts with A',
    sql: `SELECT id, correlation_id, account_no, first_name, last_name, email, address, notes, description, created_at
           FROM customers
           WHERE first_name LIKE 'A%'`,
  },
};

router.get('/:id', async (req, res) => {
  const queryDef = QUERIES[req.params.id];
  if (!queryDef) {
    return res.status(404).json({
      error: `Unknown query "${req.params.id}". Available: ${Object.keys(QUERIES).join(', ')}`,
    });
  }

  const start = Date.now();
  try {
    const result = await db.query(queryDef.sql);
    const durationMs = Date.now() - start;
    console.log(`Query ${req.params.id} executed in ${durationMs}ms, ${result.rows.length} rows`);

    res.json({
      query: req.params.id,
      description: queryDef.description,
      rowCount: result.rows.length,
      durationMs,
      rows: result.rows,
    });
  } catch (err) {
    console.error(`Query ${req.params.id} failed:`, err.message);
    res.status(500).json({ error: 'Query execution failed', details: err.message });
  }
});

module.exports = router;

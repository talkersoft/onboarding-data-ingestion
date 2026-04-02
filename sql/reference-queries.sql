-- 10-most-recent: Retrieve the 10 most recently onboarded customers
SELECT id, correlation_id, account_no, first_name, last_name, email, address, notes, description, created_at
FROM customers
ORDER BY created_at DESC
LIMIT 10;

-- customers-with-gmail: Filter all customers with emails from @gmail.com
SELECT id, correlation_id, account_no, first_name, last_name, email, address, notes, description, created_at
FROM customers
WHERE email LIKE '%@gmail.com';

-- customers-per-month: Number of customers created per month in 2025
SELECT
    DATE_TRUNC('month', created_at) AS month,
    COUNT(*) AS customer_count
FROM customers
WHERE created_at >= '2025-01-01' AND created_at < '2026-01-01'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month;

-- duplicate-emails: Find all email addresses that appear more than once
SELECT email, COUNT(*) AS occurrences
FROM customers
GROUP BY email
HAVING COUNT(*) > 1;

-- names-starting-with-a: Find all customers whose first name starts with "A"
SELECT id, correlation_id, account_no, first_name, last_name, email, address, notes, description, created_at
FROM customers
WHERE first_name LIKE 'A%';

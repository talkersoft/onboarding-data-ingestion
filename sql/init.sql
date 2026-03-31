CREATE TABLE IF NOT EXISTS customers (
    id              SERIAL PRIMARY KEY,
    correlation_id  VARCHAR(36) NOT NULL,
    account_no      VARCHAR(50) UNIQUE NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    address         TEXT,
    notes           TEXT,
    description     TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO customers (correlation_id, account_no, first_name, last_name, email, address, notes, description, created_at) VALUES
  ('seed-0001', 'ACCT-1001', 'Alice',   'Johnson',   'alice.johnson@gmail.com',    '123 Oak St, Portland, OR 97201',     'Preferred contact: email',       'Premium member',            '2025-01-10 09:00:00'),
  ('seed-0002', 'ACCT-1002', 'Bob',     'Williams',  'bob.williams@yahoo.com',     '456 Pine Ave, Seattle, WA 98101',    'Onboarded via partner',          'Standard member',           '2025-01-22 14:30:00'),
  ('seed-0003', 'ACCT-1003', 'Andrew',  'Davis',     'andrew.davis@gmail.com',     '789 Elm Blvd, Austin, TX 73301',     'Requires invoicing',             'Enterprise customer',       '2025-02-05 10:15:00'),
  ('seed-0004', 'ACCT-1004', 'Carol',   'Martinez',  'carol.martinez@company.com', '321 Maple Dr, Denver, CO 80201',     'Trial expires 2025-03-18',       'Trial account',             '2025-02-18 11:00:00'),
  ('seed-0005', 'ACCT-1005', 'Amanda',  'Taylor',    'amanda.taylor@gmail.com',    '654 Cedar Ln, Chicago, IL 60601',    'VIP referral from ACCT-1001',    'Premium member',            '2025-03-03 08:45:00'),
  ('seed-0006', 'ACCT-1006', 'David',   'Brown',     'david.brown@yahoo.com',      '987 Birch Ct, Miami, FL 33101',      'Prefers phone contact',          'Standard member',           '2025-03-20 16:00:00'),
  ('seed-0007', 'ACCT-1007', 'Alice',   'Wilson',    'alice.wilson@gmail.com',     '147 Spruce Way, Boston, MA 02101',   'Multi-seat license',             'Enterprise customer',       '2025-04-01 09:30:00'),
  ('seed-0008', 'ACCT-1008', 'Frank',   'Anderson',  'frank.anderson@company.com', '258 Walnut St, Phoenix, AZ 85001',   'Billing dept contact',           'Standard member',           '2025-04-15 13:00:00'),
  ('seed-0009', 'ACCT-1009', 'Grace',   'Thomas',    'grace.thomas@gmail.com',     '369 Ash Rd, San Diego, CA 92101',    'Annual subscription',            'Premium member',            '2025-05-08 10:00:00'),
  ('seed-0010', 'ACCT-1010', 'Aaron',   'Jackson',   'aaron.jackson@yahoo.com',    '471 Poplar Pl, Nashville, TN 37201', 'Trial extended 30 days',         'Trial account',             '2025-05-25 15:30:00'),
  ('seed-0011', 'ACCT-1011', 'Helen',   'White',     'helen.white@company.com',    '582 Willow Dr, Atlanta, GA 30301',   'Requires SSO integration',       'Enterprise customer',       '2025-06-12 09:15:00'),
  ('seed-0012', 'ACCT-1012', 'Ivan',    'Harris',    'ivan.harris@gmail.com',      '693 Sycamore Ave, Dallas, TX 75201', 'Onboarded at conference',        'Standard member',           '2025-06-28 11:45:00'),
  ('seed-0013', 'ACCT-1013', 'Amanda',  'Clark',     'amanda.clark@yahoo.com',     '804 Cypress St, Detroit, MI 48201',  'Upgraded from trial',            'Premium member',            '2025-07-10 14:00:00'),
  ('seed-0014', 'ACCT-1014', 'Jack',    'Lewis',     'jack.lewis@company.com',     '915 Redwood Ln, Minneapolis, MN 55401', 'Evaluation period',           'Trial account',             '2025-08-05 10:30:00'),
  ('seed-0015', 'ACCT-1015', 'Karen',   'Robinson',  'karen.robinson@gmail.com',   '126 Magnolia Blvd, Charlotte, NC 28201', 'Monthly billing',            'Standard member',           '2025-09-01 08:00:00'),
  ('seed-0016', 'ACCT-1016', 'Andrew',  'Walker',    'andrew.walker@yahoo.com',    '237 Dogwood Ct, Columbus, OH 43201', 'Custom SLA agreement',           'Enterprise customer',       '2025-09-18 12:00:00'),
  ('seed-0017', 'ACCT-1017', 'Laura',   'Hall',      'laura.hall@gmail.com',       '348 Chestnut Way, San Jose, CA 95101', 'Referred 3 new accounts',      'Premium member',            '2025-10-07 09:45:00'),
  ('seed-0018', 'ACCT-1018', 'Alice',   'Allen',     'alice.johnson@gmail.com',    '459 Hickory Rd, Jacksonville, FL 32201', 'Duplicate email — verify',   'Standard member',           '2025-10-22 14:15:00'),
  ('seed-0019', 'ACCT-1019', 'Nathan',  'Young',     'nathan.young@company.com',   '561 Aspen Dr, Indianapolis, IN 46201', 'POC for department rollout',   'Trial account',             '2025-11-11 10:00:00'),
  ('seed-0020', 'ACCT-1020', 'Olivia',  'King',      'olivia.king@gmail.com',      '672 Palm Ave, San Francisco, CA 94101', 'Year-end signup',             'Enterprise customer',       '2025-12-01 16:30:00')
ON CONFLICT (account_no) DO NOTHING;

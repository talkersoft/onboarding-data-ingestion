# Implementation Plan: Onboarding Data Ingestion Service

## Tech Stack

- **Runtime:** Node.js (≥ 16)
- **Framework:** Express.js
- **Message Broker:** RabbitMQ 3 (Docker, management UI on 15672)
- **AMQP Client:** `amqplib`
- **ID Generation:** `uuid` (v4) for correlation IDs
- **Database:** PostgreSQL 16 (Docker)
- **DB Client:** `pg` (node-postgres)
- **Log Aggregator:** Seq (Docker, UI on 5380, ingestion on 5341)
- **Containerization:** Docker Compose (all services)

---

## Architecture

All services run in Docker. One `docker compose up` brings up the entire stack.

```
                                                    Shared Docker Volume
                                                    (fake S3 bucket)
                                                   ┌─────────────────┐
                            onboarding-api         │  /data/ingest/  │
                            (port 3010)            │                 │
                         ┌────────────────────┐    │  <correlationId>│
data-loader / curl ──▶   │ POST /onboarding    │──▶│  .json          │
                         │ • validate          │   └─────────────────┘
                         │ • write JSON file   │           │
                         │   to shared volume  │           │ ingestion-service reads
                         │ • publish message   │           │ file, upserts into DB,
                         │   to RabbitMQ       │           │ deletes file
                         │ • return 202        │           ▼
                         └────────┬───────────┘   ┌──────────────────────┐
                                  │               │  ingestion-service    │
                                  │  publish      │  (RabbitMQ consumer)  │
                                  ▼               │  • consume message    │
                         ┌────────────────────┐   │  • read JSON file    │
                         │    RabbitMQ         │──▶│  • UPSERT into PG    │
                         │    (port 5672)      │   │  • delete JSON file  │
                         │    UI: 15672        │   └──────────┬───────────┘
                         └────────────────────┘              │
                                                             ▼
                                                  ┌──────────────────┐
                                                  │   PostgreSQL 16   │
                                                  │   customers table │
                                                  └──────────────────┘
                                                          ▲
                                                          │
                                                     init-db container
                                                     (schema + seed data)

                         ┌────────────────────┐
                         │  query-service       │          │
curl / run-queries.sh──▶ │  (port 3002)        │──────────┘
                         │  GET /queries/:id   │   reads from Postgres
                         │  (q1, q2, q3, q4, q5)
                         └────────────────────┘
```

### Docker Services

| Service              | Port  | Description                                                         |
|----------------------|-------|---------------------------------------------------------------------|
| `postgres`           | 5432  | PostgreSQL 16 database                                              |
| `rabbitmq`           | 5672 / 15672 | Message broker + management UI                               |
| `seq`                | 5380 / 5341 | Structured log aggregator (UI on 5380, ingestion API on 5341) |
| `init-db`            | —     | Runs once: creates schema + inserts seed data, then exits           |
| `onboarding-api`     | 3010  | Receives form data, writes file to volume, publishes to RabbitMQ    |
| `ingestion-service`  | —     | Consumes from RabbitMQ, reads file, upserts into DB, deletes file   |
| `query-service`      | 3002  | Exposes SQL queries Q1–Q5 as HTTP endpoints                        |
| `data-loader`        | —     | Posts test data in 3 phases (new, changed, bad), then exits         |

### Shared Volume (Fake S3)

A Docker named volume (`ingest-data`) is mounted into both `onboarding-api` and `ingestion-service` at `/data/ingest/`. This simulates an S3 bucket:

- **onboarding-api** writes a JSON file named `<correlationId>.json` containing the customer data.
- **ingestion-service** reads that file, upserts the data into Postgres, then deletes the file.

The file's lifecycle mirrors the real pattern: data lands in object storage, a consumer processes it, then it's cleaned up.

---

## Project Structure

```
onboarding-data-ingestion/
├── docker-compose.yml
├── package.json
├── demo.sh                     # One command: tear down → rebuild → load data → query
├── README.md
├── logs.md                     # Seq search syntax reference
├── requirements.md
├── implementation.md
├── architecture.md
├── .gitignore
├── scripts/
│   ├── wait-for-services.sh    # Poll until all services are healthy
│   └── run-queries.sh          # Hit query-service endpoints for Q1–Q5
├── test-data/
│   ├── customers.json          # Phase 1: new customers
│   ├── customers-updates.json  # Phase 2: changed customers (same accountNo, different data)
│   └── customers-errors.json   # Phase 3: intentionally bad data (validation failures)
├── sql/
│   ├── init.sql                # Schema + seed data (run by init-db container)
│   └── reference-queries.sql   # Raw SQL for reference (Q1–Q5, not used at runtime)
├── init-db/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       └── init-db.js          # Connects to Postgres with retry, runs init.sql
├── onboarding-api/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js           # Entry point (port 3010)
│       ├── app.js              # Express app setup
│       ├── config.js           # Environment-based configuration
│       ├── logger.js           # Structured logger (console + Seq)
│       ├── middleware/
│       │   ├── correlationId.js
│       │   └── requestLogger.js
│       ├── routes/
│       │   └── onboarding.js
│       ├── services/
│       │   ├── fileService.js      # Writes JSON to shared volume
│       │   └── messageService.js   # Publishes to RabbitMQ
│       └── validators/
│           └── onboarding.js
├── ingestion-service/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js            # Entry point (connects to RabbitMQ, starts consuming)
│       ├── config.js           # Environment-based configuration
│       ├── logger.js           # Structured logger (console + Seq)
│       ├── db.js               # Postgres connection pool
│       ├── consumer.js         # RabbitMQ consumer logic + deterministicId generation
│       └── services/
│           ├── fileService.js      # Reads + deletes JSON from shared volume
│           └── customerService.js  # UPSERT into customers table
├── query-service/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js           # Entry point (port 3002)
│       ├── app.js              # Express app setup
│       ├── config.js
│       ├── db.js               # Postgres connection pool
│       └── routes/
│           └── queries.js      # GET /queries/:id (q1–q5)
└── data-loader/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── loader.js           # Posts test data in 3 phases
        └── logger.js           # Structured logger (console + Seq)
```

---

## Correlation ID Strategy

Every incoming request gets a unique `correlationId` (UUID v4). This ID flows through every stage:

1. **Generated** by the `data-loader` (or any client), sent via `x-correlation-id` header.
2. **Used as the filename** for the JSON file written to the shared volume (`<correlationId>.json`).
3. **Included in the RabbitMQ message** payload so the consumer knows which file to read and can log with the same ID.
4. **Logged by every service** at every step — the same correlationId appears across `data-loader`, `onboarding-api`, and `ingestion-service` logs.
5. **Returned to the caller** in the response `x-correlation-id` header.

### deterministicId (HMAC)

In addition to the per-request `correlationId`, the `ingestion-service` generates a `deterministicId` using `HMAC_SHA256(secret_key, accountNo)`. This produces the same hash for the same account number, regardless of when the request was made. Search by `deterministicId` in Seq to see every INSERT and UPDATE operation for a given account.

---

## Structured Log Aggregation (Seq)

All Node.js services ship structured logs to **Seq** — a purpose-built log aggregator.

### How it works

Each service has a `logger.js` module that:
1. Outputs JSON to `stdout` (visible in `docker compose logs`).
2. POSTs the same event to Seq's ingestion endpoint (`http://seq:5341/api/events/raw?clef`) in CLEF format (fire-and-forget).

Seq indexes every JSON property as a searchable field. No schema definition needed.

### Searchable properties

| Property | Example | Purpose |
|---|---|---|
| `correlationId` | `correlationId = 'a1b2...'` | Trace one request across all services |
| `operation` | `operation = 'INSERTED'` | Find database inserts vs updates |
| `deterministicId` | `deterministicId = 'abc123...'` | Find all ops for one account |
| `service` | `service = 'ingestion-service'` | Filter by service |
| `accountNo` | `accountNo = 'ACCT-2001'` | Filter by account |
| `@Level` | `@Level = 'Warning'` | Find errors and warnings |

See [logs.md](logs.md) for more search examples.

### CLEF mapping

| Our field | CLEF field | Seq display |
|---|---|---|
| `timestamp` | `@t` | Event timestamp |
| `level` (INFO/WARN/ERROR) | `@l` (Information/Warning/Error) | Level badge |
| `message` | `@mt` | Message template |
| `correlationId` | `correlationId` | Indexed property |
| `service` | `service` | Indexed property |
| Any context fields | Spread into event | Indexed properties |

---

## Component Details

### `onboarding-api` (port 3010)

Receives form data, persists it as a file, and signals the ingestion service via RabbitMQ. Does **not** connect to the database.

#### `src/config.js`

| Variable          | Default                      | Purpose                          |
|-------------------|------------------------------|----------------------------------|
| `PORT`            | `3000`                       | Listen port                      |
| `RABBITMQ_URL`    | `amqp://user:password@rabbitmq:5672` | RabbitMQ connection        |
| `INGEST_DATA_DIR` | `/data/ingest`               | Shared volume mount path         |
| `EXCHANGE_NAME`   | `onboarding_exchange`        | RabbitMQ exchange name           |
| `QUEUE_NAME`      | `onboarding_queue`           | RabbitMQ queue name              |
| `ROUTING_KEY`     | `customer.onboarded`         | RabbitMQ routing key             |

#### `src/middleware/correlationId.js`

- Checks for an incoming `x-correlation-id` header (honors upstream callers).
- If absent, generates a new UUID v4.
- Sets `req.correlationId`.

#### `src/middleware/requestLogger.js`

- Logs on **request entry**: method, path, correlationId.
- Logs on **response finish**: method, path, status code, duration (ms), correlationId.

#### `src/validators/onboarding.js`

- Validates presence of `accountNo`, `firstName`, `lastName`, `email`.
- Validates that all four are non-empty strings.
- Validates basic email format (contains `@`).
- Returns a clear error object on failure.

#### `src/routes/onboarding.js`

Handler for `POST /onboarding`:

1. Validate the request body. If invalid, return `400` with errors.
2. Call `fileService.write()` — writes `{ accountNo, firstName, lastName, email, address, notes, description }` to `/data/ingest/<correlationId>.json`.
3. Call `messageService.publish()` — publishes `{ correlationId, fileName }` to RabbitMQ.
4. Return `202 Accepted` with `{ correlationId, status: "accepted" }`.

Returns `202` (not `200`) because processing is **asynchronous** — the data has been accepted and queued, not yet persisted to the database.

#### `src/services/messageService.js`

- Connects to RabbitMQ on startup (with retry).
- Asserts both the exchange and queue on connect (ensures no messages are lost if ingestion-service connects later).
- `publish(correlationId, fileName)` — publishes to `onboarding_exchange` with routing key `customer.onboarded`.

---

### `ingestion-service` (RabbitMQ consumer)

No HTTP server. Runs as a background worker consuming from RabbitMQ.

#### `src/config.js`

| Variable          | Default                      | Purpose                       |
|-------------------|------------------------------|-------------------------------|
| `RABBITMQ_URL`    | `amqp://user:password@rabbitmq:5672` | RabbitMQ connection     |
| `INGEST_DATA_DIR` | `/data/ingest`               | Shared volume mount path      |
| `QUEUE_NAME`      | `onboarding_queue`           | RabbitMQ queue name           |
| `EXCHANGE_NAME`   | `onboarding_exchange`        | RabbitMQ exchange name        |
| `ROUTING_KEY`     | `customer.onboarded`         | RabbitMQ routing key          |
| `DB_HOST`         | `postgres`                   | Postgres host                 |
| `DB_PORT`         | `5432`                       | Postgres port                 |
| `DB_NAME`         | `onboarding`                 | Database name                 |
| `DB_USER`         | `user`                       | Database user                 |
| `DB_PASSWORD`     | `password`                   | Database password             |
| `HMAC_SECRET`     | `onboarding-default-key`     | Secret key for deterministicId |

#### `src/consumer.js`

1. Connects to RabbitMQ (with retry).
2. Asserts exchange (`onboarding_exchange`, type `direct`).
3. Asserts queue (`onboarding_queue`), binds to exchange with routing key `customer.onboarded`.
4. On message received:
   a. Parse message → extract `correlationId`, `fileName`.
   b. Read JSON file from shared volume.
   c. UPSERT into `customers` table. Detects INSERT vs UPDATE via PostgreSQL `xmax` column.
   d. Generate `deterministicId` via `HMAC_SHA256(HMAC_SECRET, accountNo)`.
   e. Log operation with `correlationId`, `operation` (INSERTED/UPDATED), `deterministicId`, and `accountNo`.
   f. Delete the JSON file, acknowledge the message.

#### `src/services/customerService.js`

- `upsert(correlationId, data)` — `INSERT INTO customers (...) ON CONFLICT (account_no) DO UPDATE SET ... RETURNING id, xmax`. Returns `{ id, operation }` where operation is `INSERTED` or `UPDATED`.

---

### `query-service` (port 3002)

Read-only HTTP service. Runs the five required SQL queries and returns results as JSON.

#### `src/routes/queries.js`

| Endpoint          | Query | Description                              |
|-------------------|-------|------------------------------------------|
| `GET /queries/q1` | Q1    | 10 most recently onboarded customers     |
| `GET /queries/q2` | Q2    | Customers with `@gmail.com` emails       |
| `GET /queries/q3` | Q3    | Customer count per month in 2025         |
| `GET /queries/q4` | Q4    | Duplicate email addresses                |
| `GET /queries/q5` | Q5    | Customers whose first name starts with "A" |

---

### `data-loader` (test data client)

A Node.js Docker service that loads test data through the pipeline in three phases:

1. **new-customers** — posts `customers.json` (new records, all should be INSERTED)
2. **changed-customers** — posts `customers-updates.json` (existing accountNos with modified data, should be UPDATED)
3. **bad-data** — posts `customers-errors.json` (missing/invalid fields, should be rejected with 400)

Generates a unique `correlationId` for each customer POST and sends structured logs to Seq for the per-request events. Phase-level bookmarks are console-only (not sent to Seq).

---

### `init-db` (Database Initializer)

Runs once at startup, then exits.

- Connects to Postgres with retry logic (5s intervals, max 10 retries).
- Reads and executes `sql/init.sql`.
- Exits after completion.

---

## Database

### Schema (`sql/init.sql`)

```sql
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
```

- **`account_no`** — the business key. The `UNIQUE` constraint enables `ON CONFLICT (account_no) DO UPDATE` upserts.
- **`correlation_id`** — traceability only. Links each row to the request that last created or updated it.
- **`address`**, **`notes`**, **`description`** — optional text fields.

Seed data: 20 rows with explicit `created_at` values spanning Jan–Dec 2025, designed to exercise all five queries.

---

## SQL Queries (`sql/reference-queries.sql`)

| # | Description | Key SQL |
|---|-------------|---------|
| Q1 | 10 most recently onboarded customers | `ORDER BY created_at DESC LIMIT 10` |
| Q2 | Customers with `@gmail.com` emails | `WHERE email LIKE '%@gmail.com'` |
| Q3 | Customer count per month in 2025 | `DATE_TRUNC('month', created_at)` + `GROUP BY`, filtered to 2025 |
| Q4 | Duplicate email addresses | `GROUP BY email HAVING COUNT(*) > 1` |
| Q5 | Customers whose first name starts with "A" | `WHERE first_name LIKE 'A%'` |

The `.sql` file is for reference only. The actual queries are hardcoded in `query-service/src/routes/queries.js`.

---

## Test Data

### `test-data/customers.json`

8 customer records posted in phase 1 (new-customers). Includes one intentional duplicate `accountNo` to test upsert within the same phase.

### `test-data/customers-updates.json`

3 customer records posted in phase 2 (changed-customers). Same `accountNo`s as phase 1 but with modified email, address, notes, and description to demonstrate the UPDATE path.

### `test-data/customers-errors.json`

4 intentionally invalid records posted in phase 3 (bad-data). Tests missing email, invalid email format, missing accountNo, and missing firstName. All should return 400 with validation errors logged as warnings.

---

## Error Handling

| Scenario                           | Where              | Behavior                                                     |
|------------------------------------|--------------------|--------------------------------------------------------------|
| Missing/invalid fields             | onboarding-api     | Return `400`, log warning with correlationId                 |
| File write failure                 | onboarding-api     | Return `500`, log error with correlationId                   |
| RabbitMQ publish failure           | onboarding-api     | Return `500`, log error with correlationId                   |
| File not found on consume          | ingestion-service  | Log error, nack message                                      |
| DB upsert failure on consume       | ingestion-service  | Log error, nack message                                      |
| File delete failure after upsert   | ingestion-service  | Log warning (non-fatal — data is in DB)                      |

---

## How to Run

```bash
./demo.sh
```

Tears down, rebuilds, loads test data (3 phases), runs all SQL queries, prints results. One command. See [README.md](README.md).

### Tear Down

```bash
docker compose down -v
```

---

## Out of Scope

- Authentication / authorization
- Database migrations tooling (using raw init script for simplicity)
- Dead-letter queue retry logic
- Rate limiting
- Unit tests
- Frontend

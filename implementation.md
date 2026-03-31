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
curl / test script ──▶   │ POST /onboarding    │──▶│  .json          │
                         │ • validate          │   └─────────────────┘
                         │ • write JSON file   │           │
                         │   to shared volume  │           │ ingestion-service reads
                         │ • publish message   │           │ file, inserts into DB,
                         │   to RabbitMQ       │           │ deletes file
                         │ • return 202        │           ▼
                         └────────┬───────────┘   ┌──────────────────────┐
                                  │               │  ingestion-service    │
                                  │  publish      │  (RabbitMQ consumer)  │
                                  ▼               │  • consume message    │
                         ┌────────────────────┐   │  • read JSON file    │
                         │    RabbitMQ         │──▶│  • INSERT into PG    │
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
| `ingestion-service`  | —     | Consumes from RabbitMQ, reads file, inserts into DB, deletes file   |
| `query-service`      | 3002  | Exposes SQL queries Q1–Q5 as HTTP endpoints                        |

### Shared Volume (Fake S3)

A Docker named volume (`ingest-data`) is mounted into both `onboarding-api` and `ingestion-service` at `/data/ingest/`. This simulates an S3 bucket:

- **onboarding-api** writes a JSON file named `<correlationId>.json` containing the customer data.
- **ingestion-service** reads that file, inserts the data into Postgres, then deletes the file.

The file's lifecycle mirrors the real pattern: data lands in object storage, a consumer processes it, then it's cleaned up.

---

## Project Structure

```
onboarding-data-ingestion/
├── docker-compose.yml
├── package.json                # npm test → node scripts/test.js, npm run demo → ./demo.sh
├── demo.sh                     # One command: tear down → rebuild → load data → query
├── test.sh                     # One command: tear down → rebuild → run 25 assertions (calls npm test)
├── requirements.md
├── implementation.md
├── scripts/
│   ├── test.js                 # Node.js integration test suite (25 assertions)
│   ├── app-run.sh              # Build + start all containers
│   ├── app-tear-down.sh        # Stop containers + destroy all data
│   ├── wait-for-services.sh    # Poll until all services are healthy
│   ├── load-test-data.sh       # POST test data through the full pipeline
│   └── run-queries.sh          # Hit query-service endpoints for Q1–Q5
├── test-data/
│   └── customers.json          # Hardcoded test customer payloads
├── sql/
│   ├── init.sql                # Schema + seed data (run by init-db container)
│   └── queries.sql             # Raw SQL for reference (Q1–Q5)
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
│       ├── consumer.js         # RabbitMQ consumer logic
│       └── services/
│           ├── fileService.js      # Reads + deletes JSON from shared volume
│           └── customerService.js  # UPSERT into customers table
└── query-service/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── server.js           # Entry point (port 3002)
        ├── app.js              # Express app setup
        ├── config.js
        ├── db.js               # Postgres connection pool
        └── routes/
            └── queries.js      # GET /queries/:id (q1–q5)
```

---

## Correlation ID Strategy

Every incoming request gets a unique `correlationId` (UUID v4). This ID flows through every stage:

1. **Generated** in `onboarding-api` middleware, set on `req.correlationId`.
2. **Used as the filename** for the JSON file written to the shared volume (`<correlationId>.json`).
3. **Included in the RabbitMQ message** payload so the consumer knows which file to read and can log with the same ID.
4. **Logged by ingestion-service** when consuming, reading the file, inserting into DB, and deleting the file.
5. **Returned to the caller** in the response `x-correlation-id` header.

The same correlationId appears in `onboarding-api` logs, RabbitMQ message payload, and `ingestion-service` logs — full end-to-end tracing.

---

## Structured Log Aggregation (Seq)

Both `onboarding-api` and `ingestion-service` ship structured logs to **Seq** — a purpose-built log aggregator.

### How it works

Each service has a `logger.js` module that:
1. Outputs JSON to `stdout` (visible in `docker compose logs` as before).
2. POSTs the same event to Seq's ingestion endpoint (`http://seq:5341/api/events/raw?clef`) in CLEF format (fire-and-forget).

Seq indexes every JSON property as a searchable field. No schema definition needed.

### Viewing correlated logs

Open **http://localhost:5380** in a browser. You can:
- See all logs from both services in a unified timeline.
- Click a `correlationId` value to filter — shows every log entry for that single request across `onboarding-api` and `ingestion-service`.
- Filter by `service` to see only one service's logs.
- Filter by level (`Warning`, `Error`) to find problems.

### CLEF mapping

| Our field | CLEF field | Seq display |
|---|---|---|
| `timestamp` | `@t` | Event timestamp |
| `level` (INFO/WARN/ERROR) | `@l` (Information/Warning/Error) | Level badge |
| `message` | `@mt` | Message template |
| `correlationId` | `correlationId` | Indexed property |
| `service` | `service` | Indexed property (onboarding-api / ingestion-service) |
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

1. Log "request received" with correlationId and payload.
2. Validate the request body. If invalid, return `400`.
3. Call `fileService.write()` — writes `{ accountNo, firstName, lastName, email, description }` to `/data/ingest/<correlationId>.json`.
4. Call `messageService.publish()` — publishes `{ correlationId, fileName }` to RabbitMQ.
5. Return `202 Accepted` with `{ correlationId, status: "accepted" }`.

Returns `202` (not `200`) because processing is now **asynchronous** — the data has been accepted and queued, not yet persisted to the database.

#### `src/services/fileService.js`

- `write(correlationId, data)` — writes JSON to `/data/ingest/<correlationId>.json`.
- Logs file path on success.

#### `src/services/messageService.js`

- Connects to RabbitMQ on startup (with retry).
- `publish(correlationId, fileName)` — publishes to `onboarding_exchange` with routing key `customer.onboarded`.
- Message payload: `{ correlationId, fileName }`.
- Logs publish confirmation.

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

#### `src/consumer.js`

1. Connects to RabbitMQ (with retry).
2. Asserts exchange (`onboarding_exchange`, type `direct`).
3. Asserts queue (`onboarding_queue`), binds to exchange with routing key `customer.onboarded`.
4. On message received:
   a. Parse message → extract `correlationId`, `fileName`.
   b. Log "message received" with correlationId.
   c. Call `fileService.read(fileName)` — read JSON from shared volume.
   d. Log "file read" with correlationId.
   e. Call `customerService.upsert(correlationId, data)` — UPSERT into `customers` table.
   f. Log "customer upserted (id=...)" with correlationId.
   g. Call `fileService.delete(fileName)` — remove the JSON file.
   h. Log "file deleted" with correlationId.
   i. Acknowledge the message (`channel.ack`).
5. On error: log with correlationId, nack (requeue or dead-letter depending on error type).

#### `src/services/fileService.js`

- `read(fileName)` — reads and parses JSON from `/data/ingest/<fileName>`.
- `delete(fileName)` — deletes the file after successful processing.

#### `src/services/customerService.js`

- `upsert(correlationId, data)` — `INSERT INTO customers (correlation_id, account_no, first_name, last_name, email, description) ... ON CONFLICT (account_no) DO UPDATE SET ... RETURNING id`. Idempotent — posting the same `accountNo` twice updates the existing row instead of creating a duplicate.

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

Each endpoint executes the corresponding SQL query from `sql/queries.sql`, returns the result set as JSON, and logs the query execution with timing.

---

### `init-db` (Database Initializer)

Borrowed from the DTS pattern. Runs once at startup, then exits.

#### `src/init-db.js`

- Connects to Postgres with retry logic (5s intervals, max 10 retries).
- Reads and executes `sql/init.sql`.
- Logs success or failure.
- Exits after completion.

---

## Docker Compose

```yaml
services:
  postgres:
    image: postgres:16
    ...

  rabbitmq:
    image: rabbitmq:3-management
    ...

  seq:
    image: datalust/seq
    container_name: onboarding-seq
    environment:
      ACCEPT_EULA: "Y"
      SEQ_FIRSTRUN_NOAUTHENTICATION: "true"
    ports:
      - "5380:80"       # Seq web UI
      - "5341:5341"     # CLEF ingestion API

  init-db:
    build: ./init-db
    ...

  onboarding-api:
    build: ./onboarding-api
    environment:
      - ...
      - SEQ_URL=http://seq:5341
      - SERVICE_NAME=onboarding-api
    depends_on:
      - rabbitmq
      - seq
    ...

  ingestion-service:
    build: ./ingestion-service
    environment:
      - ...
      - SEQ_URL=http://seq:5341
      - SERVICE_NAME=ingestion-service
    depends_on:
      - postgres
      - rabbitmq
      - init-db
      - seq
    ...

  query-service:
    build: ./query-service
    container_name: onboarding-query-service
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=user
      - DB_PASSWORD=password
      - DB_NAME=onboarding
    depends_on:
      - postgres
      - init-db
    ports:
      - "3002:3002"

volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      device: ~/.docker/data/onboarding
      o: bind
  ingest_data:
```

Two volumes:
- **`postgres_data`** — bind mount to `~/.docker/data/onboarding` for easy teardown.
- **`ingest_data`** — shared between `onboarding-api` and `ingestion-service` (the fake S3 bucket). Ephemeral — files are deleted after processing.

---

## Database

### Schema & Seed Data (`sql/init.sql`)

```sql
CREATE TABLE IF NOT EXISTS customers (
    id              SERIAL PRIMARY KEY,
    correlation_id  VARCHAR(36) NOT NULL,
    account_no      VARCHAR(50) UNIQUE NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    description     TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

- **`account_no`** — the business key. The `UNIQUE` constraint enables `ON CONFLICT (account_no) DO UPDATE` upserts. Posting the same account number twice updates the existing row (name, email, description) instead of creating a duplicate.
- **`correlation_id`** — traceability only. Links each row to the request/log trail that last created or updated it.
- **`description`** — optional free-text field for account notes.

Seed data: ~20 rows with explicit `created_at` values designed to exercise all five queries:

- Dates spanning Jan 2025 – Dec 2025 (Q3: monthly counts)
- Mix of `@gmail.com`, `@yahoo.com`, `@company.com` domains (Q2: gmail filter)
- Duplicate emails (Q4: duplicates)
- First names starting with "A": Alice, Andrew, Amanda, etc. (Q5: starts with A)
- Recent dates for Q1 (10 most recent)

---

## SQL Queries (`sql/queries.sql`)

| # | Description | Key SQL |
|---|-------------|---------|
| Q1 | 10 most recently onboarded customers | `ORDER BY created_at DESC LIMIT 10` |
| Q2 | Customers with `@gmail.com` emails | `WHERE email LIKE '%@gmail.com'` |
| Q3 | Customer count per month in 2025 | `DATE_TRUNC('month', created_at)` + `GROUP BY`, filtered to 2025 |
| Q4 | Duplicate email addresses | `GROUP BY email HAVING COUNT(*) > 1` |
| Q5 | Customers whose first name starts with "A" | `WHERE first_name LIKE 'A%'` |

---

## Test Data

### `test-data/customers.json`

Hardcoded array of customer objects to POST through the full pipeline:

```json
[
  { "accountNo": "ACCT-2001", "firstName": "John",  "lastName": "Doe",   "email": "john.doe@example.com",  "description": "New customer signup" },
  { "accountNo": "ACCT-2002", "firstName": "Alice", "lastName": "Smith", "email": "alice.smith@gmail.com", "description": "Referred by Bob" },
  ...
  { "accountNo": "ACCT-2002", "firstName": "Alice", "lastName": "Smith", "email": "alice.smith@gmail.com", "description": "Updated — now premium member" },
  ...
]
```

Separate from seed data. Seed data proves SQL queries work on startup. Test data proves the live pipeline works end-to-end (API → file → RabbitMQ → consumer → DB). Note that `ACCT-2002` appears twice — the second POST upserts the row, updating the description from "Referred by Bob" to "Updated — now premium member".

### `scripts/load-test-data.sh`

Reads `test-data/customers.json`, loops through each entry, and POSTs to `http://localhost:3010/onboarding`. Logs each response (including correlationId). Demonstrates the full async pipeline in action.

---

## Scripts

### Root-Level Scripts

Both live at the repo root. Both are self-contained — they tear down, rebuild, and start from scratch. No assumptions about prior state.

#### `demo.sh` — Full end-to-end demo

Tears down any previous run, rebuilds all images, starts the stack, waits for healthy, loads test data through the pipeline, waits for async processing, then runs all five SQL queries and prints results.

```bash
./demo.sh
```

#### `test.sh` — Automated integration tests

Tears down, rebuilds, starts the stack, waits for healthy, then runs 25 assertions covering validation, submission, correlation ID pass-through, upsert idempotency, seed data, and all query endpoints. Calls `npm test` which runs `node scripts/test.js`.

```bash
./test.sh       # or: npm test
```

#### `scripts/test.js` — Node.js test runner

The actual test logic. 25 assertions in 7 groups:

| Group | Assertions | What it proves |
|---|---|---|
| Health Checks | 2 | Both services respond |
| Validation | 6 | Bad input → 400 with correct error messages (incl. accountNo) |
| Successful Submission | 3 | Valid payload → 202 with correlationId |
| Correlation ID Pass-Through | 2 | Custom `x-correlation-id` header echoed back |
| Upsert on accountNo | 7 | Same accountNo twice → 1 row; name, email, and description all updated |
| Seed Data | 1 | Seed rows present in database |
| Query Endpoints | 8 | Q1–Q5 return 200, invalid → 404, results are correct |

### `scripts/` — Individual Building Blocks

#### `scripts/app-run.sh`

```bash
#!/bin/bash
mkdir -p ~/.docker/data/onboarding
docker compose build
docker compose up
```

#### `scripts/app-tear-down.sh`

```bash
#!/bin/bash
echo "WARNING: This will stop all containers and destroy the database."
read -p "Are you sure? Type 'yes' to continue: " confirm
case "$confirm" in
    [yY][eE][sS] | [yY])
        docker compose down -v
        rm -rf ~/.docker/data/onboarding
        echo "Done. All data destroyed."
        ;;
    *)
        echo "Aborted."
        exit 1
        ;;
esac
```

#### `scripts/wait-for-services.sh`

Polls health endpoints until all services are up (onboarding-api on 3010, query-service on 3002). Times out after 60 seconds. Used by `demo.sh` and `test.js` to avoid acting before services are ready.

#### `scripts/load-test-data.sh`

Posts every entry from `test-data/customers.json` through the API. Logs each response (including correlationId).

#### `scripts/run-queries.sh`

Hits each query-service endpoint and prints the results:

```bash
#!/bin/bash
for q in q1 q2 q3 q4 q5; do
  echo "=== $q ==="
  curl -s http://localhost:3002/queries/$q | jq .
  echo ""
done
```

---

## Log Format

All log output is structured JSON. Each entry contains `timestamp`, `level`, `service`, `correlationId`, and `message`, plus any additional context fields.

**Console output** (via `docker compose logs`):
```json
{"timestamp":"2025-06-15T10:30:00.000Z","level":"INFO","service":"onboarding-api","correlationId":"a1b2c3d4-...","message":"Incoming request: POST /onboarding","body":{...}}
{"timestamp":"2025-06-15T10:30:00.001Z","level":"INFO","service":"onboarding-api","correlationId":"a1b2c3d4-...","message":"Validation passed"}
{"timestamp":"2025-06-15T10:30:00.003Z","level":"INFO","service":"onboarding-api","correlationId":"a1b2c3d4-...","message":"File written: /data/ingest/a1b2c3d4-....json"}
{"timestamp":"2025-06-15T10:30:00.008Z","level":"INFO","service":"onboarding-api","correlationId":"a1b2c3d4-...","message":"Message published to onboarding_exchange"}
{"timestamp":"2025-06-15T10:30:00.009Z","level":"INFO","service":"onboarding-api","correlationId":"a1b2c3d4-...","message":"Response sent: 202 (9ms)","statusCode":202,"durationMs":9}
```

```json
{"timestamp":"2025-06-15T10:30:00.050Z","level":"INFO","service":"ingestion-service","correlationId":"a1b2c3d4-...","message":"Message received from onboarding_queue"}
{"timestamp":"2025-06-15T10:30:00.052Z","level":"INFO","service":"ingestion-service","correlationId":"a1b2c3d4-...","message":"File read: /data/ingest/a1b2c3d4-....json"}
{"timestamp":"2025-06-15T10:30:00.058Z","level":"INFO","service":"ingestion-service","correlationId":"a1b2c3d4-...","message":"Customer upserted into database (id=21)"}
{"timestamp":"2025-06-15T10:30:00.059Z","level":"INFO","service":"ingestion-service","correlationId":"a1b2c3d4-...","message":"File deleted: /data/ingest/a1b2c3d4-....json"}
{"timestamp":"2025-06-15T10:30:00.060Z","level":"INFO","service":"ingestion-service","correlationId":"a1b2c3d4-...","message":"Message acknowledged"}
```

**Seq** (at http://localhost:5380) receives the same events and indexes every field. Click any `correlationId` to see the full request lifecycle across both services in one view.

---

## Error Handling

| Scenario                           | Where              | Behavior                                                     |
|------------------------------------|--------------------|--------------------------------------------------------------|
| Missing/invalid fields             | onboarding-api     | Return `400`, log warning with correlationId                 |
| File write failure                 | onboarding-api     | Return `500`, log error with correlationId                   |
| RabbitMQ publish failure           | onboarding-api     | Return `500`, log error with correlationId (file already written — orphan) |
| File not found on consume          | ingestion-service  | Log error, nack message (dead-letter)                        |
| DB insert failure on consume       | ingestion-service  | Log error, nack with requeue (transient) or dead-letter (permanent) |
| File delete failure after insert   | ingestion-service  | Log warning (non-fatal — data is in DB, file is stale)       |
| Unexpected error                   | any service        | Log full error with correlationId                            |

---

## How to Run

### Full Demo

```bash
./demo.sh
```

Tears down, rebuilds, loads test data, runs queries, prints results. One command.

### Automated Tests

```bash
./test.sh       # or: npm test
```

Tears down, rebuilds, runs 29 assertions, prints pass/fail. One command.

### Manual Step-by-Step

```bash
./scripts/app-run.sh                    # terminal 1: build + start (foreground)
./scripts/load-test-data.sh             # terminal 2: post test data
sleep 3                                 # wait for async processing
./scripts/run-queries.sh                # terminal 2: prove data arrived
open http://localhost:5380              # Seq log viewer (correlated structured logs)
open http://localhost:15672             # RabbitMQ UI (user/password)
docker compose logs onboarding-api onboarding-ingestion-service   # raw console logs
```

### Tear Down

```bash
./scripts/app-tear-down.sh              # interactive confirm, nukes everything
```

---

## Out of Scope

- Authentication / authorization
- Database migrations tooling (using raw init script for simplicity)
- Dead-letter queue retry logic (DLQ exists but no automated retry)
- Rate limiting
- Unit tests (integration tests exist; unit tests per service are a natural next step)
- Frontend

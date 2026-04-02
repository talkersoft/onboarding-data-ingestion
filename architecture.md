# Architecture: Onboarding Data Ingestion — Distributed Services

## High-Level Diagram

```
                          ┌───────────────────────────────────────────────────────────────────────┐
                          │                          Seq (Log Aggregator)                         │
                          │                        http://localhost:5380                          │
                          │                                                                       │
│   All structured logs (JSON/CLEF) from data-loader,                   │
│   onboarding-api, and ingestion-service are shipped here.             │
│   Every log entry has a correlationId — click one to see              │
│   the full request trace across all services.                         │
                          │                                                                       │
                          └──────────────────────────────▲──────────────────▲─────────────────────┘
                                                         │                  │
                                                logs (HTTP POST)      logs (HTTP POST)
                                                         │                  │
                                                         │                  │
┌────────────────┐                        ┌──────────────┴──────────┐      ┌─┴────────────────────────────┐
│                │    POST /onboarding     │                        │      │                              │
│                │───────────────────────▶ │    onboarding-api      │      │     ingestion-service        │
│ (data-loader   │                         │    (port 3010)         │      │     (RabbitMQ consumer)      │
│  or curl)      │ ◀─────────────────────  │                        │      │                              │
│                │    202 Accepted         │    1. Validate         │      │     5. Consume message       │
│                │    + correlationId      │    2. Write file ──────┼──┐   │     6. Read file ───────┐    │
└────────────────┘                         │    3. Publish msg ─────┼──┼─┐ │     7. Upsert to DB     │    │
                                           │    4. Return 202       │  │ │ │     8. Delete file      │    │
                                           │                        │  │ │ │     9. Ack message      │    │
                                           └────────────────────────┘  │ │ │                         │    │
                                                                       │ │ └────────────┬────────────┘    │
                                                                       │ │              │                 │
                                                                       ▼ │              │                 │
                                           ┌────────────────────────┐  │ │              │                 │
                                           │                        │  │ │              │                 │
                                           │   Shared Volume        │◀─┘ │    read ◀────┘                 │
                                           │   (Fake S3 Bucket)     │    │                                │
                                           │                        │    │                                │
                                           │   /data/ingest/        │    │                                │
                                           │   <correlationId>.json │    │                                │
                                           │                        │    │                                │
                                           └────────────────────────┘    │                                │
                                                                         │                                │
                                                                         ▼                                │
                                           ┌────────────────────────┐   ┌──────────────────────────────┐  │
                                           │                        │   │                              │  │
                                           │   RabbitMQ             │   │   PostgreSQL 16              │  │
                                           │   (port 5672)          │   │   (port 5432)                │  │
                                           │                        │   │                              │  │
                                           │   Exchange:            │   │   customers table            │  │
                                           │   onboarding_exchange  │   │                              │  │
                                           │         │              │   │   ┌────────────────────┐     │  │
                                           │         ▼              │   │   │  id                │     │  │
                                           │   Queue:               │   │   │  correlation_id    │     │  │
                                           │   onboarding_queue ────┼──▶│   │  account_no  ◄─────┼─────┤  │
                                           │                        │   │   │  first_name        │     │  │
                                           │   UI: localhost:15672  │   │   │  last_name         │  UNIQUE│
                                           │                        │   │   │  email             │  (upsert
                                           └────────────────────────┘   │   │  address           │   key)
                                                                        │   │  notes             │     │
                                                                        │   │  description       │     │
                                                                        │   │  created_at        │     │
                                                                        │   └────────────────────┘     │
                                                                        │                              │
                                                                        └──────────────┬───────────────┘
                                                                                       │
                                                                                       │  reads
                                                                                       ▼
┌────────────────┐                         ┌────────────────────────┐   ┌──────────────────────────────┐
│                │    GET /queries/:id     │                        │   │                              │
│    Client      │───────────────────────▶ │   query-service        │──▶│   SQL Queries                │
│    (curl)      │                         │   (port 3002)          │   │                              │
│                │ ◀─────────────────────  │                        │   │   10-most-recent             │
│                │    JSON results         │   GET /queries/:id     │   │   customers-with-gmail       │
│                │                         │                        │   │   customers-per-month        │
└────────────────┘                         └────────────────────────┘   │   duplicate-emails           │
                                                                        │   names-starting-with-a      │
                                                                        │                              │
                                                                        └──────────────────────────────┘

┌────────────────┐
│    init-db     │ ──── runs once at startup ──── CREATE TABLE + INSERT seed data
└────────────────┘
```

## Data Flow — Step by Step

### Path 1: Onboarding (Write)

```
Client                  onboarding-api           Volume (S3)         RabbitMQ            ingestion-service        PostgreSQL
  │                          │                      │                   │                      │                     │
  │  POST /onboarding        │                      │                   │                      │                     │
  │  {accountNo, firstName,  │                      │                   │                      │                     │
  │   lastName, email,       │                      │                   │                      │                     │
  │   address, notes,        │                      │                   │                      │                     │
  │   description}           │                      │                   │                      │                     │
  │─────────────────────────▶│                      │                   │                      │                     │
  │                          │                      │                   │                      │                     │
  │                   1. Generate correlationId     │                   │                      │                     │
  │                   2. Validate payload           │                   │                      │                     │
  │                          │                      │                   │                      │                     │
  │                   3. Write JSON file            │                   │                      │                     │
  │                          │─────────────────────▶│                   │                      │                     │
  │                          │  <correlationId>.json│                   │                      │                     │
  │                          │                      │                   │                      │                     │
  │                   4. Publish message            │                   │                      │                     │
  │                          │──────────────────────┼──────────────────▶│                      │                     │
  │                          │                      │  {correlationId,  │                      │                     │
  │                          │                      │   fileName}       │                      │                     │
  │                          │                      │                   │                      │                     │
  │  202 Accepted            │                      │                   │                      │                     │
  │  {correlationId}         │                      │                   │                      │                     │
  │◀─────────────────────────│                      │                   │                      │                     │
  │                          │                      │                   │                      │                     │
  │                          │                      │            5. Consume message            │                     │
  │                          │                      │                   │─────────────────────▶│                     │
  │                          │                      │                   │                      │                     │
  │                          │                      │            6. Read file                  │                     │
  │                          │                      │◀─────────────────────────────────────────│                     │
  │                          │                      │  customer data    │                      │                     │
  │                          │                      │─────────────────────────────────────────▶│                     │
  │                          │                      │                   │                      │                     │
  │                          │                      │                   │               7. UPSERT (ON CONFLICT)      │
  │                          │                      │                   │                      │────────────────────▶│
  │                          │                      │                   │                      │  INSERT or UPDATE    │
  │                          │                      │                   │                      │◀────────────────────│
  │                          │                      │                   │                      │                     │
  │                          │                      │            8. Delete file                │                     │
  │                          │                      │◀─────────────────────────────────────────│                     │
  │                          │                      │  (cleanup)        │                      │                     │
  │                          │                      │                   │                      │                     │
  │                          │                      │            9. Ack message                │                     │
  │                          │                      │                   │◀─────────────────────│                     │
  │                          │                      │                   │                      │                     │
```

### Path 2: Query (Read)

```
Client                  query-service             PostgreSQL
  │                          │                      │
  │  GET /queries/q1         │                      │
  │─────────────────────────▶│                      │
  │                          │  SELECT ... FROM     │
  │                          │  customers ...       │
  │                          │─────────────────────▶│
  │                          │  result rows         │
  │                          │◀─────────────────────│
  │  200 JSON response       │                      │
  │◀─────────────────────────│                      │
```

## Log Correlation Across Services

```
correlationId = "a1b2c3d4-..."

┌─ onboarding-api ──────────────────────────────────────────────────────────────────────────┐
│                                                                                           │
│   Incoming request: POST /onboarding        { accountNo: "ACCT-2001" }                    │
│   Validation passed                         { accountNo: "ACCT-2001" }                    │
│   File written: /data/ingest/a1b2c3d4-....json                                            │
│   Message published to onboarding_exchange                                                │
│   Response sent: 202 (1ms)                                                                │
│                                                                                           │
└───────────────────────────────────────────────┬───────────────────────────────────────────┘
                                                │
                                      same correlationId
                                                │
                                                ▼
┌─ ingestion-service ───────────────────────────────────────────────────────────────────────┐
│                                                                                           │
│   Message received from onboarding_queue                                                  │
│   File read: a1b2c3d4-....json              { accountNo: "ACCT-2001", ... }               │
│   Customer INSERTED in database (id=21)     { operation: "INSERTED", deterministicId: ... }│
│   File deleted: a1b2c3d4-....json                                                         │
│   Message acknowledged                                                                    │
│                                                                                           │
└───────────────────────────────────────────────────────────────────────────────────────────┘

All visible in Seq at http://localhost:5380 — filter by correlationId.
```

## Docker Services

| Service | Image | Ports | Purpose |
|---|---|---|---|
| postgres | postgres:16 | 5432 | Customer data storage |
| rabbitmq | rabbitmq:3-management | 5672, 15672 | Message broker (async decoupling) |
| seq | datalust/seq | 5380, 5341 | Structured log aggregation + UI |
| init-db | custom (Node.js) | — | Schema + seed data (runs once, exits) |
| onboarding-api | custom (Node.js) | 3010 | HTTP API → file + message |
| ingestion-service | custom (Node.js) | — | Consumer → DB writer |
| query-service | custom (Node.js) | 3002 | SQL query API |
| data-loader | custom (Node.js) | — | Test data client (3 phases, then exits) |

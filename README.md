# Onboarding Data Ingestion

A distributed Node.js system that receives customer onboarding data, queues it via RabbitMQ, persists it to PostgreSQL, and provides query endpoints — with end-to-end structured logging via Seq.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Run the Demo

```bash
./demo.sh
```

This tears down any previous run, builds all services, loads test data (inserts, updates, and intentional validation errors), and runs SQL queries.

## Searching Logs

After the demo, open **http://localhost:5380** in your browser. Use the search bar to filter:

| Find | Search |
|---|---|
| Trace a request | `correlationId = '<id>'` |
| Inserts only | `operation = 'INSERTED'` |
| Updates only | `operation = 'UPDATED'` |
| Errors/warnings | `@Level = 'Warning' or @Level = 'Error'` |
| By service | `service = 'onboarding-api'` |
| By account | `accountNo = 'ACCT-2001'` |
| All ops for an account | `deterministicId = '<hash>'` |

See [logs.md](logs.md) for more examples.

## Tear Down

```bash
docker compose down -v
```

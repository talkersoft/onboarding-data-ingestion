# Onboarding Data Ingestion

A distributed Node.js system that receives customer onboarding data, queues it via RabbitMQ, persists it to PostgreSQL, and provides query endpoints — with end-to-end structured logging via Seq.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Run the Demo

```bash
./demo.sh
```

This tears down any previous run, builds all services, loads test data (inserts, updates, and intentional validation errors), runs SQL queries, and opens the Seq log viewer in your browser.

## Tear Down

```bash
docker compose down -v
```

# Requirements: Onboarding Data Ingestion Service

## Objective

Create a simple Node.js application that simulates receiving customer onboarding form data and forwards it to a downstream service (simulated as a dummy AWS S3 endpoint).

The focus is on **coding structure, clarity, and best practices** — not AWS knowledge or production-ready deployments.

---

## Scenario

An event contains user-submitted data from a customer onboarding form. The application must listen for this event and forward the data to a downstream Data Ingestion App via HTTP.

---

## Functional Requirements

### FR-1: Receive Onboarding Data

- Expose a `POST /onboarding` endpoint that accepts a JSON body.
- Request payload schema:

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com"
}
```

- All three fields (`firstName`, `lastName`, `email`) are required.

### FR-2: Forward Data to Downstream Service

- Forward the received data as-is (or with minor formatting) via an HTTP POST request to:
  `https://dummy-s3-location.com/ingest`
- The downstream call simulates sending data to a dummy AWS S3 API endpoint.

### FR-3: Structured Logging

- Print clearly structured logs at each step of the request lifecycle:
  1. Request received
  2. Forwarding data to downstream service
  3. Downstream response status (success or failure)
- Logs must follow best practices (structured format, contextual information).

### FR-4: Error Handling

- Handle and log errors gracefully at each step (validation, downstream call, unexpected failures).
- Return appropriate HTTP status codes to the caller.

---

## Non-Functional Requirements

### NFR-1: Runtime

- Node.js version ≥ 12.

### NFR-2: Framework

- Any framework or no framework (e.g., Express.js is optional).

### NFR-3: Local Executability

- The application must be executable locally in under 10 minutes with minimal setup.

### NFR-4: Code Quality

- Best practices in file structure, error handling, and logging.

---

## SQL Queries

The following queries assume a `customers` table with at minimum these columns:
`id`, `first_name`, `last_name`, `email`, `created_at`.

| # | Description |
|---|-------------|
| Q1 | Retrieve the 10 most recently onboarded customers. |
| Q2 | Filter all customers with emails from `@gmail.com`. |
| Q3 | Show the number of customers created per month in 2025. |
| Q4 | Find all email addresses that appear more than once. |
| Q5 | Find all customers whose first name starts with "A". |

---

## Constraints

- **Time limit:** 15 minutes.
- **Priority:** Clarity, structure, and logging best practices.

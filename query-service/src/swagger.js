const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Query Service',
    version: '1.0.0',
    description: 'Read-only API that runs pre-defined SQL queries against the customers table and returns results as JSON.',
  },
  paths: {
    '/queries/{id}': {
      get: {
        summary: 'Run a SQL query',
        description: 'Executes one of the five pre-defined queries and returns the result set.',
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'string', enum: ['10-most-recent', 'customers-with-gmail', 'customers-per-month', 'duplicate-emails', 'names-starting-with-a'] },
            description: 'Query identifier',
          },
        ],
        responses: {
          200: {
            description: 'Query results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    query: { type: 'string' },
                    description: { type: 'string' },
                    rowCount: { type: 'integer' },
                    durationMs: { type: 'integer' },
                    rows: { type: 'array', items: { $ref: '#/components/schemas/Customer' } },
                  },
                },
              },
            },
          },
          404: {
            description: 'Unknown query ID',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                },
              },
            },
          },
          500: { description: 'Query execution failed' },
        },
      },
    },
    '/health': {
      get: {
        summary: 'Health check',
        responses: {
          200: {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'ok' } },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Customer: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          correlation_id: { type: 'string' },
          account_no: { type: 'string' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          email: { type: 'string' },
          address: { type: 'string' },
          notes: { type: 'string' },
          description: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      MonthlyCount: {
        type: 'object',
        description: 'Result shape for Q3 (monthly counts)',
        properties: {
          month: { type: 'string', format: 'date-time' },
          customer_count: { type: 'integer' },
        },
      },
      DuplicateEmail: {
        type: 'object',
        description: 'Result shape for Q4 (duplicate emails)',
        properties: {
          email: { type: 'string' },
          occurrences: { type: 'integer' },
        },
      },
    },
  },
};

module.exports = spec;

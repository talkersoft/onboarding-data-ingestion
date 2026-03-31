module.exports = {
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq:5672',
  INGEST_DATA_DIR: process.env.INGEST_DATA_DIR || '/data/ingest',
  QUEUE_NAME: process.env.QUEUE_NAME || 'onboarding_queue',
  EXCHANGE_NAME: process.env.EXCHANGE_NAME || 'onboarding_exchange',
  ROUTING_KEY: process.env.ROUTING_KEY || 'customer.onboarded',
  DB_HOST: process.env.DB_HOST || 'postgres',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_NAME: process.env.DB_NAME || 'onboarding',
  DB_USER: process.env.DB_USER || 'user',
  DB_PASSWORD: process.env.DB_PASSWORD || 'password',
};

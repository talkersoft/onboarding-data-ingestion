module.exports = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq:5672',
  INGEST_DATA_DIR: process.env.INGEST_DATA_DIR || '/data/ingest',
  EXCHANGE_NAME: process.env.EXCHANGE_NAME || 'onboarding_exchange',
  QUEUE_NAME: process.env.QUEUE_NAME || 'onboarding_queue',
  ROUTING_KEY: process.env.ROUTING_KEY || 'customer.onboarded',
};

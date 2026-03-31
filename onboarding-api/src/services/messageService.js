const amqp = require('amqplib');
const config = require('../config');

let channel = null;

const RETRY_INTERVAL = 5000;
const MAX_RETRIES = 10;

async function connect(retries = 0) {
  try {
    const connection = await amqp.connect(config.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertExchange(config.EXCHANGE_NAME, 'direct', { durable: true });
    await channel.assertQueue(config.QUEUE_NAME, { durable: true });
    await channel.bindQueue(config.QUEUE_NAME, config.EXCHANGE_NAME, config.ROUTING_KEY);
    console.log(`Connected to RabbitMQ, exchange "${config.EXCHANGE_NAME}" and queue "${config.QUEUE_NAME}" asserted`);

    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err.message);
      channel = null;
    });
    connection.on('close', () => {
      console.warn('RabbitMQ connection closed, will reconnect on next publish attempt');
      channel = null;
    });
  } catch (err) {
    if (retries < MAX_RETRIES) {
      console.log(
        `RabbitMQ not ready, retrying in ${RETRY_INTERVAL / 1000}s... (${retries + 1}/${MAX_RETRIES})`
      );
      await new Promise((r) => setTimeout(r, RETRY_INTERVAL));
      return connect(retries + 1);
    }
    throw new Error(`Failed to connect to RabbitMQ after ${MAX_RETRIES} retries: ${err.message}`);
  }
}

async function publish(correlationId, fileName) {
  if (!channel) {
    throw new Error('RabbitMQ channel not available');
  }

  const message = { correlationId, fileName };
  channel.publish(
    config.EXCHANGE_NAME,
    config.ROUTING_KEY,
    Buffer.from(JSON.stringify(message)),
    { persistent: true }
  );

  return message;
}

module.exports = { connect, publish };

const amqp = require('amqplib');
const crypto = require('crypto');
const config = require('./config');
const fileService = require('./services/fileService');
const customerService = require('./services/customerService');
const { log } = require('./logger');

const HMAC_SECRET = process.env.HMAC_SECRET || 'onboarding-default-key';

function deterministicId(accountNo) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(accountNo).digest('hex').slice(0, 16);
}

const RETRY_INTERVAL = 5000;
const MAX_RETRIES = 10;

async function start(retries = 0) {
  let connection;
  try {
    connection = await amqp.connect(config.RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertExchange(config.EXCHANGE_NAME, 'direct', { durable: true });
    await channel.assertQueue(config.QUEUE_NAME, { durable: true });
    await channel.bindQueue(config.QUEUE_NAME, config.EXCHANGE_NAME, config.ROUTING_KEY);
    await channel.prefetch(1);

    console.log(`Ingestion service consuming from queue "${config.QUEUE_NAME}"`);

    channel.consume(config.QUEUE_NAME, async (msg) => {
      if (!msg) return;

      let correlationId = 'unknown';
      try {
        const payload = JSON.parse(msg.content.toString());
        correlationId = payload.correlationId || 'unknown';
        const { fileName } = payload;

        log('INFO', correlationId, `Message received from ${config.QUEUE_NAME}`, { fileName });

        const data = fileService.read(fileName);
        log('INFO', correlationId, `File read: ${fileName}`, {
          accountNo: data.accountNo,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          address: data.address,
          notes: data.notes,
          description: data.description,
        });

        const { id, operation } = await customerService.upsert(correlationId, data);
        const detId = deterministicId(data.accountNo);
        log('INFO', correlationId, `Customer ${operation} in database (id=${id})`, {
          operation,
          deterministicId: detId,
          accountNo: data.accountNo,
          customerId: id,
        });

        fileService.remove(fileName);
        log('INFO', correlationId, `File deleted: ${fileName}`);

        channel.ack(msg);
        log('INFO', correlationId, 'Message acknowledged');
      } catch (err) {
        log('ERROR', correlationId, 'Failed to process message', { error: err.message });
        channel.nack(msg, false, false);
      }
    });

    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err.message);
    });
    connection.on('close', () => {
      console.warn('RabbitMQ connection closed, exiting');
      process.exit(1);
    });
  } catch (err) {
    if (retries < MAX_RETRIES) {
      console.log(
        `RabbitMQ not ready, retrying in ${RETRY_INTERVAL / 1000}s... (${retries + 1}/${MAX_RETRIES})`
      );
      await new Promise((r) => setTimeout(r, RETRY_INTERVAL));
      return start(retries + 1);
    }
    console.error('Failed to connect to RabbitMQ after maximum retries:', err.message);
    process.exit(1);
  }
}

module.exports = { start };

const app = require('./app');
const config = require('./config');
const messageService = require('./services/messageService');

async function start() {
  await messageService.connect();

  app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`onboarding-api listening on 0.0.0.0:${config.PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start onboarding-api:', err.message);
  process.exit(1);
});

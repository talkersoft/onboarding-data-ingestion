const app = require('./app');
const config = require('./config');

app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`query-service listening on 0.0.0.0:${config.PORT}`);
});

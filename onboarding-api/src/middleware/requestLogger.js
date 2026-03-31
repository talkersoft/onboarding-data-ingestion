const { log } = require('../logger');

function requestLogger(req, res, next) {
  const start = Date.now();

  log('INFO', req.correlationId, `Incoming request: ${req.method} ${req.path}`, {
    body: req.body,
  });

  res.on('finish', () => {
    log('INFO', req.correlationId, `Response sent: ${res.statusCode} (${Date.now() - start}ms)`, {
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
}

module.exports = { requestLogger, log };

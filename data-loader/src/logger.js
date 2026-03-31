const http = require('http');

const SEQ_URL = process.env.SEQ_URL || '';
const SERVICE_NAME = process.env.SERVICE_NAME || 'unknown';

const SEQ_LEVELS = {
  INFO: 'Information',
  WARN: 'Warning',
  ERROR: 'Error',
  DEBUG: 'Debug',
};

function log(level, correlationId, message, context = {}) {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, level, service: SERVICE_NAME, correlationId, message, ...context };
  console.log(JSON.stringify(entry));

  if (!SEQ_URL) return;

  const clef = JSON.stringify({
    '@t': timestamp,
    '@l': SEQ_LEVELS[level] || 'Information',
    '@mt': typeof message === 'string' ? message : JSON.stringify(message),
    service: SERVICE_NAME,
    correlationId,
    ...context,
  });

  try {
    const url = new URL(`${SEQ_URL}/api/events/raw?clef`);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/vnd.serilog.clef', 'Content-Length': Buffer.byteLength(clef) },
    });
    req.on('error', () => {});
    req.write(clef);
    req.end();
  } catch {}
}

module.exports = { log };

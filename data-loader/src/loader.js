const http = require('http');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { log } = require('./logger');

const API_HOST = process.env.API_HOST || 'onboarding-api';
const API_PORT = process.env.API_PORT || '3000';
const DATA_DIR = process.env.DATA_DIR || '/data';
const PHASE_DELAY_MS = parseInt(process.env.PHASE_DELAY_MS || '5000', 10);

function post(customer, correlationId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(customer);
    const req = http.request({
      hostname: API_HOST,
      port: API_PORT,
      path: '/onboarding',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForApi(timeoutMs = 60000) {
  const interval = 2000;
  let elapsed = 0;
  console.log(`Waiting for onboarding-api at ${API_HOST}:${API_PORT}...`);

  while (elapsed < timeoutMs) {
    try {
      const res = await new Promise((resolve, reject) => {
        const req = http.get(`http://${API_HOST}:${API_PORT}/health`, resolve);
        req.on('error', reject);
      });
      if (res.statusCode === 200) {
        console.log(`onboarding-api is ready (${elapsed / 1000}s)`);
        return;
      }
    } catch {}
    await sleep(interval);
    elapsed += interval;
  }
  throw new Error(`onboarding-api not ready within ${timeoutMs / 1000}s`);
}

async function loadFile(filePath, phase) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found, skipping: ${filePath}`);
    return;
  }

  const customers = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`${phase}: Loading ${customers.length} customers from ${path.basename(filePath)}`);

  for (const customer of customers) {
    const correlationId = uuidv4();

    log('INFO', correlationId, `Posting customer to onboarding-api`, {
      phase,
      accountNo: customer.accountNo,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      address: customer.address,
      notes: customer.notes,
      description: customer.description,
    });

    try {
      const res = await post(customer, correlationId);
      const level = res.status >= 400 ? 'WARN' : 'INFO';
      const parsed = JSON.parse(res.body);
      const logContext = {
        phase,
        accountNo: customer.accountNo || '(missing)',
        httpStatus: res.status,
      };
      if (parsed.errors) logContext.errors = parsed.errors;
      log(level, correlationId, `Response received: ${res.status}`, logContext);
    } catch (err) {
      log('ERROR', correlationId, `Request failed`, {
        phase,
        accountNo: customer.accountNo,
        error: err.message,
      });
    }
  }

  console.log(`${phase}: Complete — ${customers.length} customers submitted`);
}

async function run() {
  console.log('Data loader starting');

  await waitForApi();

  await loadFile(path.join(DATA_DIR, 'customers.json'), 'new-customers');

  console.log(`Waiting ${PHASE_DELAY_MS / 1000}s before sending changes...`);
  await sleep(PHASE_DELAY_MS);

  await loadFile(path.join(DATA_DIR, 'customers-updates.json'), 'changed-customers');

  console.log(`Waiting ${PHASE_DELAY_MS / 1000}s before sending bad data...`);
  await sleep(PHASE_DELAY_MS);

  await loadFile(path.join(DATA_DIR, 'customers-errors.json'), 'bad-data');

  console.log('Data loader complete — all phases finished');

  await sleep(1000);
}

run().catch((err) => {
  console.error(`Data loader failed: ${err.message}`);
  process.exit(1);
});

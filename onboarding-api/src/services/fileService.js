const fs = require('fs');
const path = require('path');
const config = require('../config');

function write(correlationId, data) {
  const dir = config.INGEST_DATA_DIR;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, `${correlationId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return filePath;
}

module.exports = { write };

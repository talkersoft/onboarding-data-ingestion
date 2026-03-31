const fs = require('fs');
const path = require('path');
const config = require('../config');

function read(fileName) {
  const filePath = path.join(config.INGEST_DATA_DIR, fileName);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function remove(fileName) {
  const filePath = path.join(config.INGEST_DATA_DIR, fileName);
  fs.unlinkSync(filePath);
}

module.exports = { read, remove };

const express = require('express');
const { validate } = require('../validators/onboarding');
const fileService = require('../services/fileService');
const messageService = require('../services/messageService');
const { log } = require('../middleware/requestLogger');

const router = express.Router();

router.post('/', async (req, res) => {
  const { correlationId } = req;
  const { accountNo, firstName, lastName, email, address, notes, description } = req.body;

  try {
    const validation = validate(req.body);
    if (!validation.valid) {
      log('WARN', correlationId, 'Validation failed', { accountNo, errors: validation.errors });
      return res.status(400).json({ errors: validation.errors, correlationId });
    }

    log('INFO', correlationId, 'Validation passed', { accountNo, firstName, lastName, email, address, notes });

    const filePath = fileService.write(correlationId, req.body);
    log('INFO', correlationId, `File written: ${filePath}`, { accountNo });

    const fileName = `${correlationId}.json`;
    await messageService.publish(correlationId, fileName);
    log('INFO', correlationId, `Message published to ${require('../config').EXCHANGE_NAME}`, {
      accountNo,
      fileName,
    });

    res.status(202).json({ correlationId, status: 'accepted' });
  } catch (err) {
    log('ERROR', correlationId, 'Failed to process onboarding request', {
      accountNo,
      error: err.message,
    });
    res.status(500).json({ error: 'Internal server error', correlationId });
  }
});

module.exports = router;

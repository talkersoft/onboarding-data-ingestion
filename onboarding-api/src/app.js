const express = require('express');
const correlationId = require('./middleware/correlationId');
const { requestLogger } = require('./middleware/requestLogger');
const onboardingRoutes = require('./routes/onboarding');

const app = express();

app.use(express.json());
app.use(correlationId);
app.use(requestLogger);

app.use('/onboarding', onboardingRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

module.exports = app;

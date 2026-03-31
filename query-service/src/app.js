const express = require('express');
const queriesRoutes = require('./routes/queries');

const app = express();

app.use('/queries', queriesRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

module.exports = app;

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const queriesRoutes = require('./routes/queries');

const app = express();

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/queries', queriesRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

module.exports = app;

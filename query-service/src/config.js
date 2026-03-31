module.exports = {
  PORT: parseInt(process.env.PORT || '3002', 10),
  DB_HOST: process.env.DB_HOST || 'postgres',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_NAME: process.env.DB_NAME || 'onboarding',
  DB_USER: process.env.DB_USER || 'user',
  DB_PASSWORD: process.env.DB_PASSWORD || 'password',
};

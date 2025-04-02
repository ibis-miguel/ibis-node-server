const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('quickquid', 'user123', 'password123', {
  host: process.env.NODE_ENV === 'production' ? 'db' : 'localhost',
  dialect: 'postgres',
});

module.exports = sequelize;

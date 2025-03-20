const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('quickquid', 'user123', 'password123', {
  host: 'db',
  dialect: 'postgres',
});

module.exports = sequelize;

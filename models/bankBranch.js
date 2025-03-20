const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BankBranch = sequelize.define('BankBranch', {
  bank_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  branch_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  bank_address: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

module.exports = BankBranch;

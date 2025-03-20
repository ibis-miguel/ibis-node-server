const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Person = require('./person');
const BankBranch = require('./bankBranch');

const Account = sequelize.define('Account', {
  account_number: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  account_type: {
    type: DataTypes.ENUM('SAVINGS', 'LOAN', 'CREDIT_CARD', 'CURRENT_ACCOUNT'),
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
  },
  balance: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
});

Account.belongsTo(Person, { foreignKey: 'person_id', onDelete: 'SET NULL' });
Account.belongsTo(BankBranch, { foreignKey: 'branch_id', onDelete: 'SET NULL' });

module.exports = Account;

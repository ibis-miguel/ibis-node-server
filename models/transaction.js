const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Account = require('./account');
const BankBranch = require('./bankBranch');

const Transaction = sequelize.define('Transaction', {
  amount: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  status: {
    type: DataTypes.ENUM('COMPLETED', 'PENDING', 'FAILED'),
    allowNull: false,
  },
  transaction_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

Transaction.belongsTo(Account, { as: 'sender', foreignKey: 'sender_account_id' });
Transaction.belongsTo(Account, { as: 'receiver', foreignKey: 'receiver_account_id' });
Transaction.belongsTo(BankBranch, { foreignKey: 'originating_branch_id', onDelete: 'SET NULL' });

module.exports = Transaction;

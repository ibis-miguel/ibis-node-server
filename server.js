const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sequelize = require('./config/database');
const Person = require('./models/person');
const BankBranch = require('./models/bankBranch');
const Account = require('./models/account');
const Transaction = require('./models/transaction');

const app = express();
const port = 8080;

app.use(express.json());

const corsOptions = {
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, 
  };
  
  app.use(cors(corsOptions));


  sequelize.sync({ alter: true }).then(() => {
    console.log('Database synced and tables altered (if necessary).');
    app.listen(port, () => {
      console.log(`Server has started on port: ${port}`);
    });
  }).catch((err) => {
    console.error('Error syncing database:', err);
  });
  

app.post('/person', async (req, res) => {
    const { firstName, lastName } = req.body;
  
    try {
      const person = await Person.create({ first_name: firstName, last_name: lastName });
      res.status(201).json(person);
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });
  
  app.post('/bank', async (req, res) => {
    const { bankName, branchName, bankAddress } = req.body;
  
    try {
      const bankBranch = await BankBranch.create({ bank_name: bankName, branch_name: branchName, bank_address: bankAddress });
      res.status(201).json(bankBranch);
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  app.post('/account', async (req, res) => {
    const { accountNumber, accountType, currency, firstName, lastName, bankName, balance } = req.body;
  
    try {
      const person = await Person.findOne({ where: { first_name: firstName, last_name: lastName } });
      if (!person) {
        return res.status(400).json({ message: 'Person not found' });
      }
  
      const branch = await BankBranch.findOne({ where: { bank_name: bankName } });
      if (!branch) {
        return res.status(400).json({ message: 'Bank branch not found' });
      }
  
      const account = await Account.create({
        account_number: accountNumber,
        account_type: accountType,
        currency,
        balance,
        person_id: person.id,
        branch_id: branch.id,
      });
  
      res.status(201).json(account);
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  app.post('/transaction', async (req, res) => {
    const { amount, description, senderAccount, receiverAccount, status, originatingBranch } = req.body;
  
    try {
      const sender = await Account.findOne({ where: { account_number: senderAccount } });
      if (!sender) {
        return res.status(400).json({ message: 'Sender account not found' });
      }
  
      const receiver = await Account.findOne({ where: { account_number: receiverAccount } });
      if (!receiver) {
        return res.status(400).json({ message: 'Receiver account not found' });
      }
  
      if (sender.balance < amount) {
        return res.status(400).json({ message: 'Insufficient funds' });
      }
  
      const transaction = await Transaction.create({
        amount,
        description,
        status,
        sender_account_id: sender.id,
        receiver_account_id: receiver.id,
        originating_branch_id: originatingBranch.id,
      });
  
      res.status(201).json(transaction);
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });


  app.get('/bank/all', async (req, res) => {
    try {
      const bankBranches = await BankBranch.findAll();
  
      const banks = bankBranches.map(bank => ({
        id: bank.id,
        bankName: bank.bank_name,
        branchName: bank.branch_name,
        bankAddress: bank.bank_address
      }));
  
      res.status(200).json(banks);
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: 'Error retrieving bank branches' });
    }
  });
  
  app.get('/transaction/account', async (req, res) => {
    const { accountNumber } = req.query;
  
    try {
      const transactions = await Transaction.findAll({
        where: {
          [Sequelize.Op.or]: [
            { sender_account_id: Sequelize.literal(`(SELECT id FROM accounts WHERE account_number = '${accountNumber}')`) },
            { receiver_account_id: Sequelize.literal(`(SELECT id FROM accounts WHERE account_number = '${accountNumber}')`) }
          ]
        },
        include: [
          {
            model: Account,
            as: 'sender',
            attributes: ['account_number', 'account_type', 'balance'],
            include: [
              {
                model: Person,
                attributes: ['first_name', 'last_name']
              }
            ]
          },
          {
            model: Account,
            as: 'receiver',
            attributes: ['account_number', 'account_type', 'balance'],
            include: [
              {
                model: Person,
                attributes: ['first_name', 'last_name']
              }
            ]
          },
          {
            model: BankBranch,
            attributes: ['bank_name', 'branch_name']
          }
        ]
      });
  

      const formattedTransactions = transactions.map(transaction => ({
        amount: transaction.amount,
        sender: `${transaction.sender.person.first_name} ${transaction.sender.person.last_name}`,
        receiver: `${transaction.receiver.person.first_name} ${transaction.receiver.person.last_name}`,
        bank: `${transaction.originating_branch.bank_name} - ${transaction.originating_branch.branch_name}`,
        date: transaction.transaction_date,
        description: transaction.description,
        status: transaction.status
      }));
  
      res.status(200).json(formattedTransactions);
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: 'Error retrieving transactions' });
    }
  });
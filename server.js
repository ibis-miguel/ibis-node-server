const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sequelize = require('./config/database');
const Person = require('./models/person');
const BankBranch = require('./models/bankBranch');
const Account = require('./models/account');
const Transaction = require('./models/transaction');
const { Sequelize } = require('sequelize');
require('dotenv').config();

const app = express();
const port = process.env.PORT;

app.use(express.json());

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.ORIGIN_1,
      process.env.ORIGIN_2
    ];

    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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

    const account = await Account.create({
      account_number: accountNumber,
      account_type: accountType,
      currency,
      balance,
      person_id: person.id,
      branch_id: bankName.id,
    });

    res.status(201).json(account);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});


app.post('/transaction', async (req, res) => {
  const { amount, description, senderAccount, receiverAccount, originatingBranch } = req.body;

  try {
    const sender = await Account.findOne({ where: { account_number: senderAccount } });
    if (!sender) {
      return res.status(400).json({ message: 'Sender account not found' });
    }

    const receiver = await Account.findOne({ where: { account_number: receiverAccount } });
    if (!receiver) {
      return res.status(400).json({ message: 'Receiver account not found' });
    }

    let status;
    if (sender.balance < amount) {
      status = 'FAILED';
    } else {
      status = 'COMPLETED';
      sender.balance -= amount;
      receiver.balance += amount;

      await sender.save();
      await receiver.save();
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
    const senderAccount = await Account.findOne({
      where: { account_number: accountNumber },
      include: [
        {
          model: Person,
          as: 'Person',
        },
      ],
    });

    if (!senderAccount) {
      return res.status(400).json({ message: 'Account not found' });
    }

    const transactions = await Transaction.findAll({
      where: {
        [Sequelize.Op.or]: [
          { sender_account_id: senderAccount.id },
          { receiver_account_id: senderAccount.id },
        ],
      },
      include: [
        {
          model: Account,
          as: 'sender',
          attributes: ['account_number', 'account_type', 'balance'],
          include: [
            {
              model: Person,
              attributes: ['first_name', 'last_name'],
            },
          ],
        },
        {
          model: Account,
          as: 'receiver',
          attributes: ['account_number', 'account_type', 'balance'],
          include: [
            {
              model: Person,
              attributes: ['first_name', 'last_name'],
            },
          ],
        },
        {
          model: BankBranch,
          attributes: ['bank_name', 'branch_name'],
        },
      ],
    });
    const formattedTransactions = transactions.map((transaction) => ({
      amount: transaction.amount,
      sender: transaction.sender.Person
        ? `${transaction.sender.Person.first_name} ${transaction.sender.Person.last_name}`
        : 'Unknown Sender',
      receiver: transaction.receiver.Person
        ? `${transaction.receiver.Person.first_name} ${transaction.receiver.Person.last_name}`
        : 'Unknown Receiver',
      bank: transaction.originating_branch
        ? `${transaction.originating_branch.bank_name} - ${transaction.originating_branch.branch_name}`
        : 'No Bank Info',
      date: transaction.transaction_date,
      description: transaction.description,
      status: transaction.status,
    }));

    res.status(200).json(formattedTransactions);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Error retrieving transactions' });
  }
});


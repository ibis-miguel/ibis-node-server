const express = require('express')
const cors = require('cors')
const axios = require('axios');
const pool = require('./db')
const port = 8080

const app = express()
app.use(express.json())


const corsOptions = {
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, 
  };
  
  app.use(cors(corsOptions));


app.get('/setup', async (req, res) => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS person (
                id SERIAL PRIMARY KEY,
                first_name VARCHAR(100),
                last_name VARCHAR(100)
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS bank_branch (
                id SERIAL PRIMARY KEY,
                bank_name VARCHAR(255),
                branch_name VARCHAR(255),
                bank_address VARCHAR(255)
            );
        `);

        await pool.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type_enum') THEN
                    CREATE TYPE account_type_enum AS ENUM ('SAVINGS', 'LOAN', 'CREDIT_CARD', 'CURRENT_ACCOUNT');
                END IF;
            END $$;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS account (
                account_number VARCHAR(50) PRIMARY KEY,
                account_type account_type_enum,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                currency VARCHAR(3),
                balance DOUBLE PRECISION,
                person_id INT,
                branch_id INT,
                FOREIGN KEY (person_id) REFERENCES person(id) ON DELETE SET NULL,
                FOREIGN KEY (branch_id) REFERENCES bank_branch(id) ON DELETE SET NULL
            );
        `);

        await pool.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status_enum') THEN
                    CREATE TYPE transaction_status_enum AS ENUM ('COMPLETED', 'PENDING', 'FAILED');
                END IF;
            END $$;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS transaction (
                id SERIAL PRIMARY KEY,
                originating_branch_id INT,
                receiver_account_id VARCHAR(50),
                sender_account_id VARCHAR(50),
                transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                description TEXT,
                status transaction_status_enum,
                FOREIGN KEY (originating_branch_id) REFERENCES bank_branch(id) ON DELETE SET NULL,
                FOREIGN KEY (receiver_account_id) REFERENCES account(account_number) ON DELETE CASCADE,
                FOREIGN KEY (sender_account_id) REFERENCES account(account_number) ON DELETE CASCADE
            );
        `);

        res.status(200).send({ message: "Successfully created tables" });
    } catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
});

const runSetupOnStart = async () => {
    try {
        await axios.get('http://localhost:8080/setup');
        console.log('Setup completed successfully');
    } catch (err) {
        console.error('Error during setup:', err);
    }
};

app.post('/person', async (req, res) => {
    const { firstName, lastName } = req.body;
    try {
        const result = await pool.query(`
            INSERT INTO person (first_name, last_name)
            VALUES ($1, $2)
            RETURNING id, first_name, last_name;
        `, [firstName, lastName]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
});

app.post('/bank', async (req, res) => {
    const { bankName, branchName, bankAddress } = req.body;
    try {
        const result = await pool.query(`
            INSERT INTO bank_branch (bank_name, branch_name, bank_address)
            VALUES ($1, $2, $3)
            RETURNING id, bank_name, branch_name, bank_address;
        `, [bankName, branchName, bankAddress]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
});

app.post('/account', async (req, res) => {
    const { accountNumber, accountType, createdAt, currency, firstName, lastName, bankName, balance } = req.body;

    try {
        const personResult = await pool.query(`
            SELECT id FROM person WHERE first_name = $1 AND last_name = $2
        `, [firstName, lastName]);

        if (personResult.rows.length === 0) {
            return res.status(400).json({ message: 'Person not found' });
        }

        const personId = personResult.rows[0].id;

        const branchId = bankName.id;

        const result = await pool.query(`
            INSERT INTO account (account_number, account_type, created_at, currency, first_name, last_name, bank_name, balance, person_id, branch_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING account_number, account_type, created_at, currency, first_name, last_name, bank_name, balance, person_id, branch_id;
        `, [
            accountNumber, accountType, createdAt, currency, firstName, lastName, bankName, balance, personId, branchId
        ]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
});


app.post('/transaction', async (req, res) => {
    const { amount, description, senderAccount, receiverAccount, status, originatingBranch } = req.body;

    try {
        const senderAccountResult = await pool.query(`
            SELECT id FROM account WHERE account_number = $1
        `, [senderAccount]);

        if (senderAccountResult.rows.length === 0) {
            return res.status(400).json({ message: 'Sender account not found' });
        }

        const senderAccountId = senderAccountResult.rows[0].id;

        const receiverAccountResult = await pool.query(`
            SELECT id FROM account WHERE account_number = $1
        `, [receiverAccount]);

        if (receiverAccountResult.rows.length === 0) {
            return res.status(400).json({ message: 'Receiver account not found' });
        }

        const receiverAccountId = receiverAccountResult.rows[0].id;

        const originatingBranchId = originatingBranch.rows[0].id;

        const result = await pool.query(`
            INSERT INTO transaction (originating_branch_id, receiver_account_id, sender_account_id, amount, description, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, originating_branch_id, receiver_account_id, sender_account_id, transaction_date, description, status;
        `, [
            originatingBranchId, receiverAccountId, senderAccountId, amount, description, status
        ]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
});

app.get('/bank/all', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM bank_branch');

        res.status(200).json(result.rows);
    } catch (err) {
        console.log(err);
        res.sendStatus(500);  
    }
});

app.get('/transaction/account', async (req, res) => {
    const { accountNumber } = req.query;

    try {
        const result = await pool.query(`
            SELECT 
                t.amount,
                t.description,
                t.transaction_date AS date,
                t.status,
                sender.first_name AS sender_first_name,
                sender.last_name AS sender_last_name,
                receiver.first_name AS receiver_first_name,
                receiver.last_name AS receiver_last_name,
                bb.bank_name AS bank
            FROM transaction t
            LEFT JOIN account sender_account ON sender_account.account_number = t.sender_account_id
            LEFT JOIN account receiver_account ON receiver_account.account_number = t.receiver_account_id
            LEFT JOIN person sender ON sender.id = sender_account.person_id
            LEFT JOIN person receiver ON receiver.id = receiver_account.person_id
            LEFT JOIN bank_branch bb ON bb.id = t.originating_branch_id
            WHERE sender_account.account_number = $1 OR receiver_account.account_number = $1
        `, [accountNumber]);

        const transactions = result.rows.map(transaction => ({
            amount: transaction.amount,
            sender: `${transaction.sender_first_name} ${transaction.sender_last_name}`,
            receiver: `${transaction.receiver_first_name} ${transaction.receiver_last_name}`,
            bank: transaction.bank,
            date: transaction.date,
            description: transaction.description,
            status: transaction.status
        }));

        res.status(200).json(transactions);
    } catch (err) {
        console.log(err);
        res.sendStatus(500);  
    }
});


app.listen(port, ()=> {
    console.log(`Server has started on port: ${port}`);
    runSetupOnStart();
});
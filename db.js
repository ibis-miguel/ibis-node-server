const {Pool} = require('pg')
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'user123',
    password: 'password123',
    database: 'quickquid'
})

module.exports = pool

//change hostName, when using docker, to db
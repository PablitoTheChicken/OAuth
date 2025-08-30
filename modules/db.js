const { Pool } = require('pg');

const pool = new Pool({
  user: 'myappuser',
  host: 'localhost',
  database: 'myappdb',
  password: 'mypassword',
  port: 5432, // default Postgres port
});

module.exports = pool;
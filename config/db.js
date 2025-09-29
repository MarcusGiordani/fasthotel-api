// fasthotel-api/config/db.js
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

// Testar a conexão
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Erro ao conectar ao banco de dados:', err.stack);
    }
    client.query('SELECT NOW()', (err, result) => {
        release(); // Libera o cliente de volta para o pool
        if (err) {
            return console.error('Erro ao executar query de teste:', err.stack);
        }
        console.log('Conectado ao PostgreSQL:', result.rows[0].now);
    });
});

module.exports = pool;
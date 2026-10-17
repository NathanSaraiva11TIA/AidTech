const mysql = require('mysql2/promise');

// Nome fixo da tabela do projeto (nao vem de entrada do usuario).
const TABELA = 'agrosense_leituras';
const TABELA_RESPIROS = 'agrosense_respiros';

let pool;

// Credenciais vem SOMENTE de variaveis de ambiente (Vercel / .env.local).
function getPool() {
  if (!pool) {
    const ssl = process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: process.env.DB_SSL_STRICT !== 'false' }
      : undefined;
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl,
      waitForConnections: true,
      connectionLimit: 2,      // banco compartilhado: poucas conexoes
      maxIdle: 0,              // nao guarda conexao parada (o MySQL derruba e da ECONNRESET)
      enableKeepAlive: true,
      connectTimeout: 10000
    });
  }
  return pool;
}

module.exports = { getPool, TABELA, TABELA_RESPIROS };

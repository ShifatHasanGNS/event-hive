const { Pool } = require('pg');
const { Pool: NeonPool } = require('@neondatabase/serverless');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Please configure the connection string in your environment.');
}

const clientPreference = (process.env.DATABASE_CLIENT || inferClientFromUrl(connectionString)).toLowerCase();
const useNeon = clientPreference === 'neon';

const pool = useNeon
  ? new NeonPool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT || 30000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT || 10000),
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
  })
  : new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT || 30000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT || 10000),
  });

async function executeStatements(statements) {
  return executeWithPool(statements);
}

async function executeWithPool(statements) {
  const client = await pool.connect();
  const notices = [];
  const results = [];
  let statementNoticeBucket = null;
  const noticeListener = (msg) => {
    if (msg?.message) {
      notices.push(msg.message);
      if (Array.isArray(statementNoticeBucket)) {
        statementNoticeBucket.push(msg.message);
      }
    }
  };

  client.on('notice', noticeListener);

  try {
    for (const statement of statements) {
      const trimmed = typeof statement === 'string' ? statement.trim() : '';
      if (!trimmed) {
        continue;
      }

      const statementStart = process.hrtime.bigint();
      statementNoticeBucket = [];
      const queryResult = await client.query(trimmed);
      const statementEnd = process.hrtime.bigint();

      const hasRows = Array.isArray(queryResult.rows) && queryResult.rows.length > 0;

      const perStatementNotices = statementNoticeBucket;
      statementNoticeBucket = null;

      results.push({
        statement: trimmed,
        command: queryResult.command,
        rowCount: queryResult.rowCount ?? 0,
        durationMs: Number(statementEnd - statementStart) / 1_000_000,
        fields: Array.isArray(queryResult.fields)
          ? queryResult.fields.map((field) => ({
            name: field.name,
            dataTypeID: field.dataTypeID,
          }))
          : [],
        rows: hasRows ? queryResult.rows : [],
        text: buildTextOutput(perStatementNotices),
      });
    }
  } finally {
    client.removeListener('notice', noticeListener);
    client.release();
  }

  return { notices, results };
}

function buildTextOutput(noticeMessages) {
  if (Array.isArray(noticeMessages) && noticeMessages.length) {
    return noticeMessages.join('\n');
  }
  return '';
}

function inferClientFromUrl(url) {
  return /\.neon\.tech/i.test(url || '') ? 'neon' : 'pg';
}

function shouldUseSsl(url) {
  if (process.env.DATABASE_SSL === 'false') {
    return false;
  }
  return !/localhost|127\.0\.0\.1/.test(url || '');
}

module.exports = {
  executeStatements,
};

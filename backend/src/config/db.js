// =============================================================================
// src/config/db.js
// PostgreSQL Connection Pool
// =============================================================================
//
// WHY A POOL (not a single connection)?
//   Every HTTP request needs to run a database query. If we used a single
//   connection, all requests would queue up — one at a time. A pool maintains
//   multiple open connections (default: 10) and assigns one to each incoming
//   request. When the query finishes, the connection returns to the pool for
//   reuse. This is standard practice for any production Node.js app.
//
// WHY pg.Pool and not an ORM (like Sequelize/Prisma)?
//   - We already designed the schema carefully in Phase 1.
//   - Raw SQL gives us full control, better performance, and clearer queries.
//   - No magic. You can read exactly what SQL is being executed.
//   - Better for learning — you see the actual database operations.
//
// =============================================================================

const { Pool } = require('pg');

// dotenv is loaded in server.js before this module is required,
// so process.env variables are available here.
const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Pool configuration
  max: 10,                // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,  // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Throw error if can't connect in 5 seconds
});

// ─── Connection Test ───────────────────────────────────────────────────────
// This runs once when the server starts.
// If the DB credentials are wrong or Postgres is not running, we find out
// immediately — not on the first user request.
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('   Check your .env file DB_* variables and ensure PostgreSQL is running.');
    process.exit(1); // Stop the server — no point running without a DB
  }
  release(); // Return the test connection back to the pool
  console.log(`✅ Database connected: ${process.env.DB_NAME} @ ${process.env.DB_HOST}:${process.env.DB_PORT}`);
});

// ─── Pool Error Handler ────────────────────────────────────────────────────
// Handle unexpected errors on idle clients (network drops, DB restarts, etc.)
// Without this handler, an unhandled 'error' event would crash the Node process.
pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err.message);
});

// ─── Helper: query ─────────────────────────────────────────────────────────
// We export a thin wrapper around pool.query().
//
// WHY WRAP IT?
//   - Consistent logging (dev mode shows every SQL query)
//   - Single place to add query timeout, retry logic later
//   - Controllers call db.query() — not pool.query() directly
//
// USAGE:
//   const { rows } = await db.query('SELECT * FROM users WHERE u_id = $1', [id]);
//
const query = async (text, params) => {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  // Log queries in development mode only (never in production — security risk)
  if (process.env.NODE_ENV === 'development') {
    console.log(`📋 SQL [${duration}ms]:`, text.replace(/\s+/g, ' ').trim());
  }

  return result;
};

// ─── Helper: getClient ────────────────────────────────────────────────────
// Returns a dedicated client from the pool for use in TRANSACTIONS.
//
// WHY NEEDED FOR TRANSACTIONS?
//   pool.query() automatically picks any available client.
//   A transaction (BEGIN...COMMIT) MUST run on the SAME client.
//   If you mix clients, PostgreSQL will error or silently corrupt data.
//
// USAGE (in service files):
//   const client = await db.getClient();
//   try {
//     await client.query('BEGIN');
//     await client.query('INSERT INTO ...', [...]);
//     await client.query('UPDATE wallets SET ...', [...]);
//     await client.query('COMMIT');
//   } catch (err) {
//     await client.query('ROLLBACK');
//     throw err;
//   } finally {
//     client.release(); // ALWAYS release back to pool
//   }
//
const getClient = () => pool.connect();

module.exports = { query, getClient };

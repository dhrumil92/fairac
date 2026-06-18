// =============================================================================
// server.js
// Application Entry Point
// =============================================================================
//
// This file does three things:
//   1. Loads environment variables from .env FIRST (before anything else)
//   2. Imports the configured Express app
//   3. Starts the HTTP server on the configured port
//
// WHY LOAD dotenv FIRST?
//   The db.js pool reads process.env.DB_PASSWORD when it's required.
//   If dotenv hasn't loaded yet, those variables would be undefined.
//   Always require('dotenv').config() as the very first line.
//
// =============================================================================

require('dotenv').config(); // Load .env variables into process.env — MUST be first

const app  = require('./src/app');

// Initialize background workers
require('./src/modules/sessions/sessions.worker');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 FairAC Server started`);
  console.log(`   Port:        ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
  console.log(`   Health:      http://localhost:${PORT}/health`);
  console.log('='.repeat(50));
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────────
// When the process receives SIGTERM (from Ctrl+C or deployment platform),
// we close the server gracefully — finish in-flight requests before shutting down.
// This prevents cutting off a request in the middle of a DB transaction.
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed.');
    process.exit(0);
  });
});

// ─── Unhandled Rejection Safety Net ───────────────────────────────────────
// If an async function throws and nobody catches it, this handler prevents
// the Node process from crashing silently.
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  // In production you'd want to alert your monitoring system here
});

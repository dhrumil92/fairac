// =============================================================================
// src/app.js
// Express Application Setup
// =============================================================================
//
// WHY SEPARATE app.js FROM server.js?
//   server.js  = starts the HTTP server (listens on a port)
//   app.js     = configures Express (middleware, routes, error handlers)
//
//   This separation is important for TESTING. In tests, you can import
//   app.js directly without starting a server (using supertest library).
//   If everything was in one file, tests would try to bind ports.
//
// =============================================================================

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');

const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// ─── Security Middleware ───────────────────────────────────────────────────
// helmet() sets ~15 secure HTTP headers automatically.
// Examples: X-Frame-Options, X-Content-Type-Options, HSTS, etc.
// These prevent clickjacking, MIME-sniffing, and other common attacks.
app.use(helmet());

// ─── CORS ──────────────────────────────────────────────────────────────────
// Allows our React frontend to make API calls to the backend.
// We allow both :3000 (CRA) and :5173 (Vite) in development.
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins in development to support mobile testing on local network
    if (process.env.NODE_ENV !== 'production') return callback(null, true);

    // Allow requests with no origin (Postman, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin} is not in the allowed list.`));
    }
  },
  credentials: true,
}));

// ─── Body Parsing ──────────────────────────────────────────────────────────
// Parse incoming JSON request bodies (e.g. POST /auth/login with {email, password})
// Without this, req.body would be undefined.
app.use(express.json({ limit: '10kb' })); // 10kb limit prevents large payload attacks

// ─── Health Check ──────────────────────────────────────────────────────────
// A simple endpoint to verify the server is running.
// Used by deployment tools, load balancers, and monitoring services.
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'FairAC API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── API Routes ────────────────────────────────────────────────────────────
// All routes are prefixed with /api/v1
// The /v1 prefix allows us to release /api/v2 later without breaking
// existing clients still using v1.
//
// Routes are added here as each module is built:
app.use('/api/v1/auth',     require('./modules/auth/auth.routes'));
app.use('/api/v1/rooms',    require('./modules/rooms/rooms.routes'));
app.use('/api/v1/sessions', require('./modules/sessions/sessions.routes'));
app.use('/api/v1/wallet',   require('./modules/wallet/wallet.routes'));
app.use('/api/v1/admin',    require('./modules/admin/admin.routes'));
app.use('/api/v1/iot',      require('./modules/iot/iot.routes'));
app.use('/api/v1/support',  require('./modules/support/support.routes'));

// ─── 404 Handler ───────────────────────────────────────────────────────────
// If no route matched above, this catches it and returns a clean 404.
// Without this, Express returns an HTML "Cannot GET /..." page.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ─── Global Error Handler ──────────────────────────────────────────────────
// MUST be the LAST app.use() call.
// Express knows it's an error handler because it has 4 parameters (err, req, res, next).
app.use(errorHandler);

module.exports = app;

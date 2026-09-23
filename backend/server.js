// ============================================================
// SERVER - Main Express Application
// ============================================================

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import compression from 'compression';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool, { testConnection } from './db.js';
import adminRoutes from './routes/admin.js';
import examRoutes from './routes/exams.js';
import candidateRoutes from './routes/candidates.js';
import attemptRoutes from './routes/attempts.js';
import resultRoutes from './routes/results.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 5001;

// ============================================================
// PRODUCTION SECURITY & PERFORMANCE MIDDLEWARE
// ============================================================

// Security HTTP headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Gzip / Brotli compression
app.use(compression());

// CORS configuration (allows all in production if not explicitly set)
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5001'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server) or matching origins
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'production') {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Request logging (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ============================================================
// HEALTH & MONITORING
// ============================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    pid: process.pid,
    memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', async (req, res) => {
  try {
    await testConnection();
    res.json({
      status: 'ok',
      database: 'connected',
      uptimeSeconds: Math.round(process.uptime()),
      pid: process.pid,
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      message: error.message
    });
  }
});

// ============================================================
// API ROUTES
// ============================================================

app.use('/api/auth', adminRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/results', resultRoutes);

// ============================================================
// STATIC FRONTEND SERVING (Production SPA)
// ============================================================

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { maxAge: '1d' }));

  // SPA Route Fallback: Any non-API route serves index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ============================================================
// 404 HANDLER FOR UNKNOWN API ROUTES
// ============================================================

app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.originalUrl
  });
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================================
// SERVER START & GRACEFUL SHUTDOWN
// ============================================================

let server;

async function startServer() {
  try {
    await testConnection();
    console.log('✓ Database connection pool established');

    server = app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🚀 ATOM QMS - High Concurrency Production Server      ║
║                                                            ║
║     Port:        http://localhost:${PORT}                  ║
║     Worker PID:  ${process.pid}                                    ║
║     Environment: ${process.env.NODE_ENV || 'production'}                   ║
║     Database:    ${process.env.DB_NAME || 'railway'}                   ║
║     Gzip:        Enabled                                   ║
║     SPA Mode:    ${fs.existsSync(distPath) ? 'Serving dist/ build' : 'API only'}                ║
║                                                            ║
║     Health:      GET /api/health                           ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop existing processes or change PORT.`);
      } else {
        console.error('Server startup error:', error.message);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown handling
const handleShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Closing HTTP server and database connections gracefully...`);
  if (server) {
    server.close(() => {
      console.log('✓ HTTP server closed');
      pool.end().then(() => {
        console.log('✓ Database connection pool drained');
        process.exit(0);
      }).catch(() => process.exit(0));
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

startServer();

export default app;

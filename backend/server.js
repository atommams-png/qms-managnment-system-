// ============================================================
// SERVER - Main Express Application
// ============================================================

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { testConnection } from './db.js';
import adminRoutes from './routes/admin.js';
import examRoutes from './routes/exams.js';
import candidateRoutes from './routes/candidates.js';
import attemptRoutes from './routes/attempts.js';
import resultRoutes from './routes/results.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// MIDDLEWARE
// ============================================================

// CORS configuration
const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : ['http://localhost:5173'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', async (req, res) => {
  try {
    await testConnection();
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// ============================================================
// API ROUTES
// ============================================================

// Admin routes
app.use('/api/auth', adminRoutes);

// Exam routes
app.use('/api/exams', examRoutes);

// Candidate routes
app.use('/api/candidates', candidateRoutes);

// Attempt routes
app.use('/api/attempts', attemptRoutes);

// Result routes
app.use('/api/results', resultRoutes);

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path
  });
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================================
// SERVER START
// ============================================================

async function startServer() {
  try {
    // Test database connection
    await testConnection();
    console.log('✓ Database connection successful');

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🚀 ATOM QMS Backend API                               ║
║                                                            ║
║     Server running on: http://localhost:${PORT}           ║
║     Environment: ${process.env.NODE_ENV || 'development'}
║     Database: ${process.env.DB_NAME}                      ║
║                                                            ║
║     Health Check: GET /api/health                         ║
║     API Docs: See routes/ folder                          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use.`);
        console.error('Stop the existing process, or change PORT in backend/.env.');
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

startServer();

export default app;

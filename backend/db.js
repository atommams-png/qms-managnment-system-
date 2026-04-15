// ============================================================
// DATABASE CONNECTION
// ============================================================

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'code_exam_guard',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Keep DATETIME values in local wall-clock time to avoid UI schedule shifts.
  timezone: 'local'
});

// Test connection
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT 1');
    connection.release();
    return true;
  } catch (error) {
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Database connection error: Access denied.');
      console.error('Check backend/.env DB_USER and DB_PASSWORD values.');
      console.error('Tip: run "npm run init:db" from backend after setting valid credentials.');
    } else {
      console.error('Database connection error:', error.message);
    }
    throw error;
  }
}

export default pool;

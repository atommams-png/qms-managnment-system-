// ============================================================
// DATABASE CONNECTION
// ============================================================

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306', 10),
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'atom_qms',

  waitForConnections: true,

  connectionLimit: parseInt(
    process.env.DB_POOL_LIMIT || '40',
    10
  ),

  queueLimit: parseInt(
    process.env.DB_QUEUE_LIMIT || '2000',
    10
  ),

  enableKeepAlive: true,
  keepAliveInitialDelay: 0,

  connectTimeout: 10000,

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

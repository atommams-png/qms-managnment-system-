// ============================================================
// DATABASE CONNECTION
// ============================================================

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',

  port: parseInt(
    process.env.MYSQLPORT || process.env.DB_PORT || '3306',
    10
  ),

  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',

  password:
    process.env.MYSQLPASSWORD ||
    process.env.DB_PASSWORD ||
    '',

  database:
    process.env.MYSQLDATABASE ||
    process.env.MYSQL_DATABASE ||
    process.env.DB_NAME ||
    'railway',

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
  let connection;

  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(`
      SELECT
        DATABASE() AS database_name,
        @@hostname AS mysql_host,
        USER() AS mysql_user
    `);

    console.log('✓ Database connection pool established');
    console.log('✓ Connected database:', rows[0].database_name);
    console.log('✓ MySQL host:', rows[0].mysql_host);
    console.log('✓ MySQL user:', rows[0].mysql_user);

    return true;
  } catch (error) {
    console.error('Database connection error:', error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

export default pool;
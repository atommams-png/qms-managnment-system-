

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load .env for local development.
// Railway environment variables are injected automatically.
dotenv.config();

// ============================================================
// MYSQL CONNECTION POOL
// ============================================================

const pool = mysql.createPool({
  // Railway MySQL variables
  host:
    process.env.MYSQLHOST ||
    process.env.DB_HOST ||
    'localhost',

  port: parseInt(
    process.env.MYSQLPORT ||
    process.env.DB_PORT ||
    '3306',
    10
  ),

  user:
    process.env.MYSQLUSER ||
    process.env.DB_USER ||
    'root',

  password:
    process.env.MYSQLPASSWORD ||
    process.env.DB_PASSWORD ||
    '',

  database:
    process.env.MYSQLDATABASE ||
    process.env.MYSQL_DATABASE ||
    process.env.DB_NAME ||
    'railway',

  // ==========================================================
  // CONNECTION POOL SETTINGS
  // ==========================================================

  waitForConnections: true,

  connectionLimit: parseInt(
    process.env.DB_POOL_LIMIT || '10',
    10
  ),

  queueLimit: parseInt(
    process.env.DB_QUEUE_LIMIT || '100',
    10
  ),

  // ==========================================================
  // CONNECTION SETTINGS
  // ==========================================================

  enableKeepAlive: true,
  keepAliveInitialDelay: 0,

  connectTimeout: 10000,

  // Store/use database timestamps in UTC
  timezone: 'Z',

  // Return DATETIME and TIMESTAMP values as strings to prevent timezone shifting
  dateStrings: true
});

// ============================================================
// TEST DATABASE CONNECTION
// ============================================================

export async function testConnection() {
  let connection;

  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(`
      SELECT
        DATABASE() AS database_name,
        @@hostname AS mysql_host,
        USER() AS mysql_user,
        VERSION() AS mysql_version
    `);

    console.log('========================================');
    console.log('✓ DATABASE CONNECTION SUCCESSFUL');
    console.log('✓ Database:', rows[0].database_name);
    console.log('✓ MySQL Host:', rows[0].mysql_host);
    console.log('✓ MySQL User:', rows[0].mysql_user);
    console.log('✓ MySQL Version:', rows[0].mysql_version);
    console.log('========================================');

    return true;

  } catch (error) {

    console.error('========================================');
    console.error('❌ DATABASE CONNECTION FAILED');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Errno:', error.errno);
    console.error('SQL State:', error.sqlState);
    console.error('========================================');

    throw error;

  } finally {

    if (connection) {
      connection.release();
    }
  }
}

// ============================================================
// EXPORT CONNECTION POOL
// ============================================================

export default pool;

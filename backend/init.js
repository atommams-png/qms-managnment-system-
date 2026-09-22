#!/usr/bin/env node

// ============================================================
// ATOM QMS - DATABASE INITIALIZATION
// Railway / Production Safe
// ============================================================

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load local .env when running locally.
// Railway environment variables are automatically available.
dotenv.config({
  path: path.join(__dirname, '.env')
});

// ============================================================
// RAILWAY MYSQL CONFIGURATION
// ============================================================

const MYSQL_HOST =
  process.env.MYSQLHOST ||
  process.env.DB_HOST ||
  'localhost';

const MYSQL_USER =
  process.env.MYSQLUSER ||
  process.env.DB_USER ||
  'root';

const MYSQL_PASSWORD =
  process.env.MYSQLPASSWORD ||
  process.env.DB_PASSWORD ||
  '';

const MYSQL_PORT = parseInt(
  process.env.MYSQLPORT ||
  process.env.DB_PORT ||
  '3306',
  10
);

const DATABASE_NAME =
  process.env.MYSQLDATABASE ||
  process.env.DB_NAME ||
  'railway';

// ============================================================
// INITIALIZE DATABASE
// ============================================================

async function initializeDatabase() {
  let connection = null;

  try {
    console.log('');
    console.log('============================================================');
    console.log('ATOM QMS - DATABASE INITIALIZATION');
    console.log('============================================================');

    console.log(`Host: ${MYSQL_HOST}`);
    console.log(`Port: ${MYSQL_PORT}`);
    console.log(`User: ${MYSQL_USER}`);
    console.log(`Database: ${DATABASE_NAME}`);
    console.log('');

    // ----------------------------------------------------------
    // STEP 1: CONNECT DIRECTLY TO EXISTING DATABASE
    // ----------------------------------------------------------

    console.log('Step 1: Connecting to MySQL database...');

    connection = await mysql.createConnection({
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: DATABASE_NAME,
      multipleStatements: true
    });

    console.log('✓ Connected to MySQL');
    console.log(`✓ Database: ${DATABASE_NAME}`);
    console.log('');

    // ----------------------------------------------------------
    // STEP 2: LOAD SCHEMA
    // ----------------------------------------------------------

    console.log('Step 2: Loading QMS schema...');

    const possibleSchemaPaths = [
      path.join(__dirname, '../database/schema.sql'),
      path.join(__dirname, 'database/schema.sql'),
      path.join(process.cwd(), 'database/schema.sql')
    ];

    let schemaPath = null;

    for (const candidate of possibleSchemaPaths) {
      if (fs.existsSync(candidate)) {
        schemaPath = candidate;
        break;
      }
    }

    if (!schemaPath) {
      throw new Error(
        'database/schema.sql was not found. Make sure the schema is included in the deployment.'
      );
    }

    console.log(`✓ Schema found: ${schemaPath}`);

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // ----------------------------------------------------------
    // STEP 3: EXECUTE SCHEMA
    // ----------------------------------------------------------

    console.log('Step 3: Creating QMS tables...');

    // Remove SQL comments.
    const cleanedSql = schemaSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    // Execute schema.
    await connection.query(cleanedSql);

    console.log('✓ Schema executed successfully');
    console.log('');

    // ----------------------------------------------------------
    // STEP 4: VERIFY TABLES
    // ----------------------------------------------------------

    console.log('Step 4: Verifying QMS tables...');

    const expectedTables = [
      'admins',
      'exams',
      'questions',
      'candidates',
      'exam_attempts',
      'exam_results'
    ];

    const [tables] = await connection.query(
      `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_TYPE = 'BASE TABLE'
      `,
      [DATABASE_NAME]
    );

    const existingTables = tables
      .map(row => row.TABLE_NAME)
      .sort();

    for (const table of expectedTables) {
      if (existingTables.includes(table)) {
        console.log(`✓ ${table}`);
      } else {
        console.log(`✗ ${table} MISSING`);
      }
    }

    const missingTables = expectedTables.filter(
      table => !existingTables.includes(table)
    );

    if (missingTables.length > 0) {
      throw new Error(
        `Database initialization incomplete. Missing tables: ${missingTables.join(', ')}`
      );
    }

    console.log('');
    console.log('✓ All QMS tables exist');
    console.log('');

    // ----------------------------------------------------------
    // STEP 5: VERIFY DATABASE CONNECTION
    // ----------------------------------------------------------

    console.log('Step 5: Testing database...');

    const [result] = await connection.query(`
      SELECT
        DATABASE() AS database_name,
        @@hostname AS mysql_host,
        USER() AS mysql_user
    `);

    console.log(`✓ Connected database: ${result[0].database_name}`);
    console.log(`✓ MySQL host: ${result[0].mysql_host}`);
    console.log(`✓ MySQL user: ${result[0].mysql_user}`);

    // ----------------------------------------------------------
    // COMPLETE
    // ----------------------------------------------------------

    console.log('');
    console.log('============================================================');
    console.log('✓ ATOM QMS DATABASE INITIALIZATION COMPLETE');
    console.log('============================================================');
    console.log('');

    await connection.end();

    process.exit(0);

  } catch (error) {

    console.error('');
    console.error('============================================================');
    console.error('✗ DATABASE INITIALIZATION FAILED');
    console.error('============================================================');
    console.error('');
    console.error(error.message);
    console.error('');

    if (connection) {
      try {
        await connection.end();
      } catch (_) {
        // Ignore connection close error
      }
    }

    process.exit(1);
  }
}

initializeDatabase();
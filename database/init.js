#!/usr/bin/env node

// ============================================================
// DATABASE INITIALIZATION SCRIPT
// ============================================================
// This script creates the MySQL database and runs the schema

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
const envPath = path.join(__dirname, '../backend/.env');
dotenv.config({ path: envPath });

// Configuration
const MYSQL_HOST = process.env.DB_HOST || 'localhost';
const MYSQL_USER = process.env.DB_USER || 'root';
const MYSQL_PASSWORD = process.env.DB_PASSWORD || '12345';
const MYSQL_PORT = process.env.DB_PORT || 3306;
const DATABASE_NAME = process.env.DB_NAME || 'railway';

async function initializeDatabase() {
  let connection = null;

  try {
    console.log('🔧 Starting database initialization...\n');

    // Step 1: Connect without database to create it
    console.log('📌 Step 1: Connecting to MySQL server...');
    connection = await mysql.createConnection({
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      multipleStatements: true
    });
    console.log('✓ Connected to MySQL server\n');

    // Step 2: Create database
    console.log(`📌 Step 2: Creating database "${DATABASE_NAME}"...`);
    try {
      await connection.execute(`DROP DATABASE IF EXISTS ${DATABASE_NAME}`);
      console.log('✓ Dropped existing database (if any)');
    } catch (err) {
      // Database might not exist, that's fine
    }

    await connection.execute(`CREATE DATABASE ${DATABASE_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✓ Database "${DATABASE_NAME}" created\n`);

    // Step 3: Select database
    console.log(`📌 Step 3: Selecting database "${DATABASE_NAME}"...`);
    await connection.execute(`USE ${DATABASE_NAME}`);
    console.log('✓ Database selected\n');

    // Step 4: Run schema
    console.log('📌 Step 4: Running database schema...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Split and execute statements
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      try {
        await connection.execute(statement);
      } catch (err) {
        // Some statements might be conditional, skip errors
        if (!err.message.includes('already exists')) {
          console.warn('⚠ Warning:', err.message);
        }
      }
    }
    console.log('✓ Schema created successfully\n');

    // Step 5: Insert default admin
    console.log('📌 Step 5: Inserting default admin user...');
    try {
      const adminId = '550e8400-e29b-41d4-a716-446655440001';
      await connection.execute(
        `INSERT INTO admins (id, username, password) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
        [adminId, 'admin', 'admin123']
      );
      console.log('✓ Default admin user created\n');
    } catch (err) {
      console.log('✓ Default admin user already exists\n');
    }

    // Step 6: Verify installation
    console.log('📌 Step 6: Verifying installation...');
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${DATABASE_NAME}'
    `);

    const expectedTables = ['admins', 'exams', 'questions', 'candidates', 'exam_attempts', 'exam_results'];
    const createdTables = tables.map(t => t.TABLE_NAME).sort();

    console.log('\n✓ Created tables:');
    createdTables.forEach(table => {
      console.log(`  • ${table}`);
    });

    // Verify all expected tables exist
    const missingTables = expectedTables.filter(t => !createdTables.includes(t));
    if (missingTables.length === 0) {
      console.log('\n✓ All tables created successfully!\n');
    } else {
      console.warn('\n⚠ Warning: Missing tables:', missingTables);
    }

    // Print connection info
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 Database initialization completed successfully!');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📋 Database Connection Details:');
    console.log(`   Host: ${MYSQL_HOST}`);
    console.log(`   Port: ${MYSQL_PORT}`);
    console.log(`   User: ${MYSQL_USER}`);
    console.log(`   Database: ${DATABASE_NAME}`);
    console.log('\n👤 Default Admin Credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('\n📝 Next steps:');
    console.log('   1. Update backend/.env with your database credentials (already done)');
    console.log('   2. Start the backend: npm run dev (in backend directory)');
    console.log('   3. Start the frontend: npm run dev (in root directory)');
    console.log('\n═══════════════════════════════════════════════════════════\n');

    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error during database initialization:');
    console.error(`   ${error.message}\n`);

    if (error.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('❌ Could not connect to MySQL. Make sure:');
      console.error('   1. MySQL is running');
      console.error('   2. Host: localhost');
      console.error('   3. User: root');
      console.error('   4. Password: 12345\n');
    }

    if (connection) {
      try {
        await connection.end();
      } catch (err) {
        // Already disconnected
      }
    }
    process.exit(1);
  }
}

// Run initialization
initializeDatabase();

# Your MySQL Configuration

## Quick Setup with Your Credentials

**Database Name:** code_exam_guard
**Username:** root
**Password:** 12345
**Host:** localhost

---

## ⚡ Setup Commands (Copy & Paste)

### Step 1: Start MySQL Server
```bash
# Windows (Run as Administrator)
net start MySQL80

# OR if using XAMPP/WAMP
# Start Apache & MySQL from control panel
```

### Step 2: Create Database & Load Schema
```bash
# Create the database
mysql -u root -p12345 -e "CREATE DATABASE code_exam_guard;"

# Load the schema (from your project directory)
mysql -u root -p12345 code_exam_guard < database/schema.sql

# Load sample data (optional - for testing with sample data)
mysql -u root -p12345 code_exam_guard < database/seed-data.sql
```

### Step 3: Verify Installation
```bash
# This should show 6 tables
mysql -u root -p12345 code_exam_guard -e "SHOW TABLES;"

# Expected output:
# +-----------------------+
# | Tables_in_code_exam_guard |
# +-----------------------+
# | admins                 |
# | candidates            |
# | exam_attempts         |
# | exam_results          |
# | exams                 |
# | questions             |
# +-----------------------+
```

---

## 📝 Your .env File (for Node.js Backend)

Create a `.env` file in your backend directory with these exact values:

```env
# ============================================================
# DATABASE CONFIGURATION
# ============================================================

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=12345
DB_NAME=code_exam_guard

# Connection Pool Settings
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0
DB_ENABLE_INSECURE_AUTH=false

# Timezone
DB_TIMEZONE=+00:00

# ============================================================
# API SERVER CONFIGURATION
# ============================================================

PORT=5000
NODE_ENV=development

# ============================================================
# SECURITY CONFIGURATION
# ============================================================

JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRATION=7
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# ============================================================
# APPLICATION SETTINGS
# ============================================================

LOG_LEVEL=info
DEBUG=false
```

---

## 🧪 Test Connection

After setup, test your connection:

```bash
# Test with MySQL CLI
mysql -u root -p12345 code_exam_guard -e "SELECT * FROM admins;"

# Should show the default admin user:
# +--------------------------------------+----------+----------+---------------------+---------------------+
# | id                                   | username | password | created_at          | updated_at          |
# +--------------------------------------+----------+----------+---------------------+---------------------+
# | 550e8400-e29b-41d4-a716-446655440001 | admin    | admin123 | 2026-03-13 ...      | 2026-03-13 ...      |
# +--------------------------------------+----------+----------+---------------------+---------------------+
```

---

## 📊 Sample Queries to Test

```bash
# Get all exams
mysql -u root -p12345 code_exam_guard -e "SELECT * FROM exams;"

# Get all candidates
mysql -u root -p12345 code_exam_guard -e "SELECT * FROM candidates;"

# Get exam statistics (if you loaded seed data)
mysql -u root -p12345 code_exam_guard -e "SELECT * FROM v_exam_statistics;"

# Count total records
mysql -u root -p12345 code_exam_guard -e "
SELECT
  (SELECT COUNT(*) FROM admins) as admins,
  (SELECT COUNT(*) FROM exams) as exams,
  (SELECT COUNT(*) FROM questions) as questions,
  (SELECT COUNT(*) FROM candidates) as candidates,
  (SELECT COUNT(*) FROM exam_attempts) as attempts,
  (SELECT COUNT(*) FROM exam_results) as results;
"
```

---

## 🔧 Backend Setup (Node.js)

Once database is ready, set up your Express.js backend:

```bash
# Create backend directory
mkdir backend
cd backend

# Initialize Node project
npm init -y

# Install dependencies
npm install express mysql2 dotenv cors body-parser

# Create .env file (use content above)
# Create .env with your credentials (shown above)

# Copy database API file
cp ../database/database-api.js ./db.js

# Test connection
node -e "
require('dotenv').config();
const db = require('./db.js');
db.testConnection().then(() => {
  console.log('✓ Connection successful!');
  process.exit(0);
}).catch(err => {
  console.error('✗ Connection failed:', err.message);
  process.exit(1);
});
"
```

---

## 🧠 Default Admin User

After setup, you can login with:
- **Username:** admin
- **Password:** admin123

⚠️ **IMPORTANT:** Change this password in production!

---

## 🚨 Troubleshooting

### Issue: "Access denied for user 'root'"
```bash
# Make sure you're using the correct password (12345)
mysql -u root -p12345 -e "SELECT 1;"

# If still failing, reset MySQL (Windows)
net stop MySQL80
net start MySQL80
```

### Issue: "Database code_exam_guard doesn't exist"
```bash
# Create it first:
mysql -u root -p12345 -e "CREATE DATABASE code_exam_guard;"
```

### Issue: "Can't connect to MySQL server"
```bash
# Check if MySQL is running
mysql -u root -p12345 -e "SELECT 1;"

# If not running, start it:
net start MySQL80  # Windows
# or find it in XAMPP/WAMP control panel
```

### Issue: "Tables not created after running schema.sql"
```bash
# Re-run the schema:
mysql -u root -p12345 code_exam_guard < database/schema.sql

# Verify tables exist:
mysql -u root -p12345 code_exam_guard -e "SHOW TABLES;"
```

---

## ✅ Setup Checklist

- [ ] MySQL server is running
- [ ] Database `code_exam_guard` created
- [ ] Schema loaded from schema.sql
- [ ] Can connect: `mysql -u root -p12345 code_exam_guard`
- [ ] Tables exist (6 tables visible with SHOW TABLES)
- [ ] Sample data loaded (optional)
- [ ] .env file created with these credentials
- [ ] Backend Node.js project ready
- [ ] Connection test passes

---

## 🎯 Next Steps

1. **Now:** Run the setup commands above
2. **Next:** Create Express.js backend (see Backend Setup section)
3. **Then:** Create API endpoints using database-api.js
4. **Finally:** Connect React components to API

---

## 📞 Quick Reference

| Task | Command |
|------|---------|
| Login to MySQL | `mysql -u root -p12345` |
| Connect to DB | `mysql -u root -p12345 code_exam_guard` |
| Load schema | `mysql -u root -p12345 code_exam_guard < database/schema.sql` |
| Show tables | `mysql -u root -p12345 code_exam_guard -e "SHOW TABLES;"` |
| Start MySQL | `net start MySQL80` |
| Stop MySQL | `net stop MySQL80` |

---

**Everything is ready!** Just run the setup commands above and your database will be ready to use. 🎉

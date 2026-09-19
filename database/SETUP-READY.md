# 🚀 ATOM QMS - Ready to Setup

## Your Database Credentials

```
Host:     localhost
Port:     3306
User:     root
Password: 12345
Database: code_exam_guard
```

---

## ✨ What You Have (11 Files)

```
database/
├── 📋 Setup & Configuration
│   ├── YOUR-SETUP.md           ← READ THIS FIRST (your custom setup guide)
│   ├── setup.bat               ← Windows auto-setup script
│   ├── setup.sh                ← Linux/Mac auto-setup script
│   └── .env.example            ← Environment variables template
│
├── 🗄️ Database Files
│   ├── schema.sql              ← Main database schema (6 tables, 2 views)
│   ├── seed-data.sql           ← Sample test data
│   └── useful-queries.sql      ← 20+ reference queries
│
├── 📖 Documentation
│   ├── INDEX.md                ← Master navigation guide
│   ├── QUICKSTART.md           ← 5-minute setup
│   ├── README.md               ← Complete reference
│   └── DATABASE-ARCHITECTURE.md ← Visual diagrams
│
└── 💻 Code
    └── database-api.js         ← Node.js API functions
```

---

## 🎯 Choose Your Setup Method

### Method 1: Automated (Recommended) ⭐

#### Windows Users
```bash
# Open Command Prompt and navigate to your project
cd C:\path\to\code-exam-guard-main

# Run the setup script
database\setup.bat

# Follow the prompts
```

**What it does:**
- ✓ Checks MySQL installation
- ✓ Tests connection with your credentials
- ✓ Creates the database
- ✓ Loads the schema
- ✓ Optionally loads sample data
- ✓ Verifies all tables were created

#### Linux/Mac Users
```bash
# Navigate to your project
cd /path/to/code-exam-guard-main

# Make script executable
chmod +x database/setup.sh

# Run the setup script
./database/setup.sh

# Follow the prompts
```

---

### Method 2: Manual Setup (5 minutes)

#### Step 1: Start MySQL
```bash
# Windows (Admin Command Prompt)
net start MySQL80

# OR use XAMPP/WAMP control panel to start MySQL
```

#### Step 2: Run Commands
```bash
# Create database
mysql -u root -p12345 -e "CREATE DATABASE code_exam_guard;"

# Load schema (from project directory)
mysql -u root -p12345 code_exam_guard < database/schema.sql

# Load sample data (optional)
mysql -u root -p12345 code_exam_guard < database/seed-data.sql
```

#### Step 3: Verify
```bash
# You should see 6 tables
mysql -u root -p12345 code_exam_guard -e "SHOW TABLES;"
```

---

## 📊 Expected Output After Setup

```
Tables in code_exam_guard:
+-----------------+
| admins          |
| candidates      |
| exam_attempts   |
| exam_results    |
| exams           |
| questions       |
+-----------------+

Views:
v_candidate_results
v_exam_statistics

Default Admin:
Username: admin
Password: admin123
```

---

## 🔧 Backend Setup (NodeJS)

Once database is ready:

```bash
# Create backend folder
mkdir backend
cd backend

# Install dependencies
npm init -y
npm install express mysql2 dotenv cors body-parser

# Create .env file
cat > .env << EOF
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=12345
DB_NAME=code_exam_guard
PORT=5000
NODE_ENV=development
EOF

# Copy database API
copy ..\database\database-api.js .\db.js

# Test connection
node -e "require('dotenv').config(); const db = require('./db.js'); db.testConnection();"
```

---

## 📝 Quick Reference

| What | Command | Expected |
|------|---------|----------|
| **Test Connection** | `mysql -u root -p12345 code_exam_guard -e "SHOW TABLES;"` | 6 tables listed |
| **View Admins** | `mysql -u root -p12345 code_exam_guard -e "SELECT * FROM admins;"` | 1 admin row |
| **Start MySQL** | `net start MySQL80` | MySQL started |
| **Stop MySQL** | `net stop MySQL80` | MySQL stopped |
| **Backup** | `mysqldump -u root -p12345 code_exam_guard > backup.sql` | Backup file created |
| **Restore** | `mysql -u root -p12345 code_exam_guard < backup.sql` | Data restored |

---

## 🧪 Test Your Setup

After setup, verify everything works:

```bash
# Test 1: Connect to database
mysql -u root -p12345 code_exam_guard -e "SELECT 1;"
# Should output: 1

# Test 2: Check tables exist
mysql -u root -p12345 code_exam_guard -e "SHOW TABLES;"
# Should list 6 tables

# Test 3: Check views
mysql -u root -p12345 code_exam_guard -e "SHOW FULL TABLES WHERE TABLE_TYPE LIKE 'VIEW';"
# Should list 2 views

# Test 4: Check default admin
mysql -u root -p12345 code_exam_guard -e "SELECT username FROM admins;"
# Should show: admin

# Test 5: Test with sample data (if loaded)
mysql -u root -p12345 code_exam_guard -e "SELECT COUNT(*) as exam_count FROM exams;"
# Should show: 2 (if seed data loaded)
```

---

## 🚨 Troubleshooting

### MySQL not found
```bash
# Add MySQL to PATH on Windows
# Or install MySQL if not already done
```

### Connection denied
```bash
# Wrong password? Try:
mysql -u root -p12345

# Or reset MySQL password if needed
```

### Database doesn't exist
```bash
# Create it:
mysql -u root -p12345 -e "CREATE DATABASE code_exam_guard;"
```

### Tables not created
```bash
# Re-run schema:
mysql -u root -p12345 code_exam_guard < database/schema.sql
```

---

## 📚 Documentation Files

| File | Purpose | Read When |
|------|---------|-----------|
| **YOUR-SETUP.md** | Your custom setup guide | First thing |
| **QUICKSTART.md** | 5-minute overview | Want quick start |
| **README.md** | Complete reference | Need details |
| **DATABASE-ARCHITECTURE.md** | Visual diagrams | Want to understand design |
| **INDEX.md** | Master navigation | Lost or confused |

---

## 🎯 What Happens Next

### Once Database is Ready (30 minutes)

1. **Backend API** (1 hour)
   - Create Express.js server
   - Use database-api.js functions
   - Create REST endpoints

2. **React Integration** (2 hours)
   - Replace localStorage with API calls
   - Update components for async data
   - Test end-to-end

3. **Production Ready** (1 hour)
   - Review security settings
   - Set up backups
   - Deploy

---

## 💡 Pro Tips

1. **Always backup before major changes**
   ```bash
   mysqldump -u root -p12345 code_exam_guard > backup.sql
   ```

2. **Use prepared statements** (database-api.js already does this)

3. **Keep .env file safe** (never commit to git)
   ```bash
   echo ".env" >> .gitignore
   ```

4. **Test queries in useful-queries.sql** before using them

5. **Use v_exam_statistics and v_candidate_results** for reports

---

## ✅ Setup Checklist

### Before Setup
- [ ] MySQL installed
- [ ] MySQL server can start
- [ ] You have the project files
- [ ] You're in the project directory

### During Setup
- [ ] Run setup.bat (Windows) or setup.sh (Linux/Mac)
- [ ] OR run manual commands if automated fails
- [ ] Load schema.sql
- [ ] (Optional) Load seed-data.sql

### After Setup
- [ ] SHOW TABLES shows 6 tables
- [ ] Can connect: `mysql -u root -p12345 code_exam_guard`
- [ ] Default admin exists
- [ ] Views created
- [ ] .env file ready for Node.js

### Backend Ready
- [ ] Express.js created
- [ ] database-api.js copied
- [ ] .env file created
- [ ] npm dependencies installed
- [ ] Connection test passes

---

## 🎉 You're All Set!

Your MySQL database is now ready for the ATOM QMS project.

**Next Step:** Choose your setup method above and follow the instructions.

If you have any questions, check:
1. YOUR-SETUP.md - Your custom setup guide
2. QUICKSTART.md - Quick reference
3. README.md - Detailed documentation
4. DATABASE-ARCHITECTURE.md - Visual explanations

---

**Total Setup Time:** 5-15 minutes (depending on method)

**Difficulty Level:** Easy ✓

Good luck! 🚀

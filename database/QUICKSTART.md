# 🌟 Quick Start Guide - MySQL Setup for ATOM QMS

## What Was Created

I've created a complete MySQL database infrastructure for your ATOM QMS project. Here are all the files:

```
database/
├── schema.sql              # Main database schema (tables, views, indexes)
├── seed-data.sql           # Sample test data for development
├── useful-queries.sql      # 20+ reference queries for reporting
├── database-api.js         # Node.js API functions (40+ functions)
├── README.md               # Complete setup & integration guide
└── .env.example            # Environment variables template
```

## ⚡ 5-Minute Quick Start

### Step 1: Create Database (Windows/Mac/Linux)
```bash
# Open MySQL command line
mysql -u root -p

# Paste these commands:
CREATE DATABASE code_exam_guard;
EXIT;
```

### Step 2: Load Schema
```bash
# From your project directory
mysql -u root -p code_exam_guard < database/schema.sql

# Type your password when prompted
```

### Step 3: Verify Installation
```bash
mysql -u root -p code_exam_guard -e "SHOW TABLES;"
```

You should see:
```
admins
candidates
exam_attempts
exam_results
exams
questions
```

## 📊 Database Schema Summary

### 6 Core Tables

| Table | Purpose | Key Features |
|-------|---------|--------------|
| **admins** | Admin credentials | username, password, timestamps |
| **exams** | Exam configuration | settings as columns, unique code, is_active flag |
| **questions** | Exam questions | type (mcq/true-false/mcq-image), JSON options |
| **candidates** | Student registration | email, USN, department, exam_id |
| **exam_attempts** | Student exam sessions | answers as JSON, tab switch tracking, submitted flag |
| **exam_results** | Calculated scores | correct/wrong/unanswered counts, marks, percentage |

### Data Relationships
```
admin creates → exam ← candidates register
                  ↓
               questions
                  ↓
            exam_attempts (students take exam)
                  ↓
            exam_results (scores calculated)
```

## 🛠️ Integration Steps

### Option 1: Quick Testing (No Backend)
```bash
# Load sample data to test queries
mysql -u root -p code_exam_guard < database/seed-data.sql

# Try queries from useful-queries.sql
mysql -u root -p code_exam_guard < database/useful-queries.sql
```

### Option 2: Full Integration with Express.js

1. **Create backend folder**
```bash
mkdir backend
cd backend
npm init -y
npm install express mysql2 dotenv cors
```

2. **Copy database setup**
```bash
cp ../database/database-api.js ./db.js
cp ../database/.env.example ./.env
```

3. **Edit `.env`**
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=code_exam_guard
PORT=5000
```

4. **Create simple Express app** (`server.js`)
```javascript
const express = require('express');
const db = require('./db.js');

const app = express();
app.use(express.json());

// Test endpoint
app.get('/api/exams', async (req, res) => {
  try {
    const exams = await db.getExams();
    res.json(exams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(5000, () => {
  console.log('Server running on port 5000');
  db.testConnection();
});
```

5. **Update React to use API**
Instead of:
```javascript
// Old - localStorage
import { getExams } from '@/lib/store';
const exams = getExams();
```

Use:
```javascript
// New - API calls
const [exams, setExams] = useState([]);
useEffect(() => {
  fetch('http://localhost:5000/api/exams')
    .then(r => r.json())
    .then(data => setExams(data));
}, []);
```

## 📈 Common Operations

### Get All Exam Results
```sql
SELECT c.name, c.usn, r.percentage, r.obtained_marks
FROM exam_results r
JOIN candidates c ON r.candidate_id = c.id
WHERE r.exam_id = 'exam_id_here'
ORDER BY r.percentage DESC;
```

### Count Candidates per Exam
```sql
SELECT e.name, COUNT(c.id) as total_candidates
FROM exams e
LEFT JOIN candidates c ON e.id = c.exam_id
GROUP BY e.id;
```

### Find High Performers (>80%)
```sql
SELECT c.name, c.usn, r.percentage
FROM exam_results r
JOIN candidates c ON r.candidate_id = c.id
WHERE r.percentage > 80
ORDER BY r.percentage DESC;
```

See `useful-queries.sql` for 20+ more queries!

## 🔒 Security Checklist

- [ ] Change default admin password in production
- [ ] Use strong MySQL password (not 'password123')
- [ ] Enable SSL for remote database connections
- [ ] Use parameterized queries (database-api.js already does this)
- [ ] Set proper user permissions (don't use root for app)
- [ ] Enable regular backups
- [ ] Hash passwords with bcrypt before storing
- [ ] Use environment variables for secrets (.env file)

## 📝 Key Features Included

✅ **Production-Ready Schema**
- Proper types and constraints
- Indexes for performance
- Cascade deletes for referential integrity
- UUID identifiers

✅ **Developer-Friendly**
- Sample data included
- Reference queries provided
- API functions ready to use
- Comprehensive documentation

✅ **Scalable Design**
- JSON fields for flexible data
- Views for complex reports
- Prepared statements for security
- Connection pooling support

✅ **Well-Documented**
- Inline SQL comments
- README with examples
- Environment templates
- Troubleshooting guide

## 🧪 Testing the Setup

```bash
# Test database connection
mysql -u root -p -h localhost -D code_exam_guard -e "SELECT * FROM admins;"

# Check table structure
mysql -u root -p -h localhost -D code_exam_guard -e "DESC exams;"

# Count tables created
mysql -u root -p -h localhost -D code_exam_guard -e "SHOW TABLES;"

# Get database size
mysql -u root -p -h localhost -D code_exam_guard -e "SELECT table_name, ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb FROM information_schema.TABLES WHERE table_schema = 'code_exam_guard';"
```

## 📚 Documentation Files

| File | Contains |
|------|----------|
| `README.md` | Complete setup guide, security, troubleshooting |
| `schema.sql` | Full schema with comments |
| `useful-queries.sql` | Reporting & analytics queries |
| `database-api.js` | Node.js function reference |
| `.env.example` | All config options explained |

## 🚀 Next Steps

1. **Immediate** - Run schema.sql to create tables
2. **Testing** - Load seed-data.sql to populate test data
3. **Development** - Use database-api.js as API layer
4. **Integration** - Connect React app to new API
5. **Production** - Deploy with proper security & backups

## 📞 Troubleshooting

**MySQL won't start?**
```bash
# Windows
net start MySQL80

# macOS
brew services start mysql

# Linux
sudo systemctl start mysql
```

**Connection refused?**
```bash
# Check MySQL is listening on port 3306
mysql -u root -p -h 127.0.0.1

# Check database exists
mysql -u root -p -e "SHOW DATABASES;"
```

**Tables not showing?**
```bash
# Verify schema was loaded
mysql -u root -p code_exam_guard -e "SHOW TABLES;"

# Try loading schema again
mysql -u root -p code_exam_guard < database/schema.sql
```

## 💡 Pro Tips

1. **Always use transactions** for multi-table operations
2. **Index on JOIN columns** for better performance
3. **Use EXPLAIN** to analyze slow queries
4. **Backup before testing** changes
5. **Use prepared statements** to prevent SQL injection
6. **Monitor query logs** in production

---

**Created:** March 2026
**Status:** Ready for Development
**Next Phase:** API Integration with React

For detailed information, see the comprehensive README.md in the database folder!

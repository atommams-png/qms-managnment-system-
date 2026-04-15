# Code Exam Guard - MySQL Database Setup Guide

## Overview

This directory contains all MySQL database-related files for the Code Exam Guard project. The application currently uses localStorage for data storage, but these files provide a production-ready MySQL database schema for deployment and scaling.

## Files in This Directory

### 1. **schema.sql**
Complete MySQL database schema with:
- Table definitions for all entities (Admins, Exams, Questions, Candidates, Attempts, Results)
- Primary keys, foreign keys, and constraints
- Appropriate indexes for performance
- Comments explaining each column and table
- Useful views for reporting

**Key Features:**
- Foreign key relationships ensuring referential integrity
- Automatic timestamp management
- JSON support for complex nested data
- Comprehensive indexing strategy

### 2. **seed-data.sql**
Sample data for development and testing, including:
- Default admin user
- 2 sample exams with different configurations
- Sample questions with various types (MCQ, MCQ-Image, True/False)
- Sample candidates
- Sample exam attempts with answers
- Sample results

**Usage:** Load this file to populate the database with test data for development.

### 3. **useful-queries.sql**
Collection of pre-built SQL queries for common operations:
- Exam management queries
- Candidate registration reports
- Exam attempt analysis
- Results and performance analytics
- Question difficulty analysis
- Data export queries
- Administrative queries

**Note:** These queries are reference examples. Adapt them based on your specific reporting needs.

## Database Schema Overview

### Tables

#### 1. **admins**
Stores admin user credentials
```
Fields: id, username, password, created_at, updated_at
Indexes: username (unique)
```

#### 2. **exams**
Stores exam information and settings
```
Fields: id, name, code, duration, marks_per_question, negative_marks,
         show_result, random_order, fullscreen_mode, tab_switch_detection,
         max_tab_switches, navigation_panel, question_timer, is_active,
         created_at, updated_at
Indexes: code (unique), is_active, created_at
```

#### 3. **questions**
Stores exam questions with options and images
```
Fields: id, exam_id, type, text, image_url, options (JSON), correct_answer,
         option_images (JSON), created_at, updated_at, display_order
Foreign Key: exam_id -> exams.id (CASCADE)
Indexes: exam_id, type, display_order
```

#### 4. **candidates**
Stores candidate registration information
```
Fields: id, exam_id, name, email, phone, college, usn, department, registered_at
Foreign Key: exam_id -> exams.id (CASCADE)
Unique Constraint: exam_id + usn + department (prevents duplicates)
Indexes: exam_id, usn, email, registered_at
```

#### 5. **exam_attempts**
Stores exam attempts by candidates
```
Fields: id, candidate_id, exam_id, answers (JSON), started_at, submitted_at,
         tab_switches, is_submitted
Foreign Keys: candidate_id -> candidates.id, exam_id -> exams.id (CASCADE)
Unique Constraint: candidate_id + exam_id (one attempt per candidate per exam)
Indexes: candidate_id, exam_id, is_submitted, started_at
```

#### 6. **exam_results**
Stores calculated exam results
```
Fields: id, attempt_id, candidate_id, exam_id, total_questions,
         correct_answers, wrong_answers, unanswered, total_marks,
         obtained_marks, percentage, calculated_at, updated_at
Foreign Keys: attempt_id, candidate_id, exam_id (CASCADE)
Indexes: attempt_id, candidate_id, exam_id, percentage, calculated_at
```

### Views

#### 1. **v_candidate_results**
Consolidated view showing candidate results with all relevant details
```sql
SELECT r.*, c.name, c.email, c.usn, c.department, c.college,
       e.name as exam_name, e.code as exam_code
FROM exam_results r
JOIN candidates c ON r.candidate_id = c.id
JOIN exams e ON r.exam_id = e.id;
```

#### 2. **v_exam_statistics**
Aggregated statistics for each exam
```sql
Includes: total candidates, submitted attempts, total questions,
          average/max/min percentage
```

## Installation Instructions

### Prerequisites
- MySQL Server 5.7+ (8.0+ recommended)
- Database client (MySQL CLI, workbench, or third-party tool)
- Appropriate user permissions to create databases and tables

### Step 1: Create Database
```sql
CREATE DATABASE code_exam_guard;
USE code_exam_guard;
```

### Step 2: Load Schema
```bash
mysql -u root -p code_exam_guard < database/schema.sql
```

Or using MySQL Client:
```sql
SOURCE /path/to/database/schema.sql;
```

### Step 3: Load Sample Data (Optional - Development Only)
```bash
mysql -u root -p code_exam_guard < database/seed-data.sql
```

### Step 4: Verify Installation
```sql
SHOW TABLES;
SELECT * FROM admins;
SELECT * FROM v_exam_statistics;
```

## Integration with React Application

### Current State
The application currently uses localStorage for data persistence. To migrate to MySQL:

### 1. Backend API (Node.js/Express)
Create API endpoints that:
- Connect to MySQL database
- Implement CRUD operations for each entity
- Mirror the current `store.ts` functions

Example endpoints:
```
POST   /api/exams                 - Create exam
GET    /api/exams                 - Get all exams
GET    /api/exams/:id             - Get exam by ID
PUT    /api/exams/:id             - Update exam
DELETE /api/exams/:id             - Delete exam

POST   /api/exams/:examId/questions    - Add question
GET    /api/exams/:examId/questions    - Get questions
PUT    /api/exams/:examId/questions/:questionId - Update question
DELETE /api/exams/:examId/questions/:questionId - Delete question

POST   /api/candidates/:examId         - Register candidate
GET    /api/exams/:examId/candidates   - Get candidates
POST   /api/attempts                   - Start attempt
PUT    /api/attempts/:attemptId        - Update attempt answers
POST   /api/results/:attemptId         - Calculate result
```

### 2. Environment Configuration
Create `.env` file:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=code_exam_guard
```

### 3. Database Connection (Node.js Example)
```javascript
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
```

## Security Considerations

### 1. **Passwords**
⚠️ **CRITICAL:** Default admin password in seed data (`admin123`) is for development ONLY.
- Hash passwords using bcrypt, scrypt, or argon2
- Never store plain text passwords in production
- Use strong password requirements

### 2. **SQL Injection Prevention**
Use parametrized queries/prepared statements:
```javascript
// BAD - vulnerable to SQL injection
const query = `SELECT * FROM candidates WHERE usn = '${usn}'`;

// GOOD - safe
const query = 'SELECT * FROM candidates WHERE usn = ?';
pool.execute(query, [usn]);
```

### 3. **Authentication**
- Implement JWT or session-based authentication
- Set appropriate expiration times
- Validate tokens on protected endpoints

### 4. **Authorization**
- Check that admins can only access their own exams
- Verify candidates can only access exams they're registered for
- Implement role-based access control if needed

### 5. **Data Validation**
- Validate all input at API level
- Sanitize question text and options
- Validate file uploads (image size, type)

### 6. **Image Storage**
For base64 images currently stored in the database:
- Consider external storage (AWS S3, Azure Blob Storage)
- Compress images before storage
- Implement CDN for faster delivery
- Set appropriate image size limits

### 7. **Backups**
Regular backup strategy:
```bash
# Daily backup
mysqldump -u root -p code_exam_guard > backup_$(date +%Y%m%d).sql

# Scheduled backup (crontab)
0 2 * * * mysqldump -u root -pPASSWORD code_exam_guard > /backups/daily_$(date +\%Y\%m\%d).sql
```

## Performance Optimization

### 1. **Indexing Strategy**
Current indexes are designed for:
- Fast lookups by exam code
- Filtering by status
- Sorting by date
- Finding duplicate candidates

### 2. **Query Optimization**
- Use EXPLAIN to analyze slow queries
- Monitor with MySQL slow query log
- Consider materialized views for complex reports

### 3. **Database Maintenance**
```sql
-- Optimize table
OPTIMIZE TABLE exams;

-- Analyze table statistics
ANALYZE TABLE exams;

-- Check table integrity
CHECK TABLE exams;
```

## Useful Admin Queries

### Get Dashboard Statistics
```sql
SELECT
  (SELECT COUNT(*) FROM exams WHERE is_active = 1) as active_exams,
  (SELECT COUNT(*) FROM candidates) as total_candidates,
  (SELECT COUNT(*) FROM exam_attempts WHERE is_submitted = 1) as completed_attempts,
  (SELECT COUNT(*) FROM exam_results) as results_generated;
```

### Find Issues
```sql
-- Attempts without results
SELECT ea.* FROM exam_attempts ea
LEFT JOIN exam_results er ON ea.id = er.attempt_id
WHERE ea.is_submitted = 1 AND er.id IS NULL;

-- Candidates not in any exam
SELECT c.* FROM candidates c
WHERE c.exam_id NOT IN (SELECT id FROM exams);
```

## Troubleshooting

### Common Issues

**1. Foreign Key Constraint Error**
- Ensure parent record exists before inserting child
- Check data types match between tables
- Verify CASCADE rules are appropriate

**2. Duplicate Entry Error**
- Check UNIQUE constraints
- Verify unique combination for composite keys

**3. Slow Queries**
- Check if indexes are being used: `EXPLAIN SELECT ...`
- Avoid SELECT * - specify needed columns
- Consider query refactoring

**4. Data Integrity Issues**
- Use transactions for multi-table operations
- Implement application-level validation
- Regular integrity checks

## Migration Path from localStorage

1. **Export localStorage data** from browser console
2. **Transform data** to SQL INSERT statements
3. **Load into MySQL** database
4. **Validate data integrity** against schema
5. **Update React API calls** to use new endpoints
6. **Test thoroughly** before production deployment

## References

- [MySQL Official Documentation](https://dev.mysql.com/doc/)
- [JSON Support in MySQL](https://dev.mysql.com/doc/refman/8.0/en/json.html)
- [Indexes and Performance](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)
- [Security Best Practices](https://dev.mysql.com/doc/refman/8.0/en/security.html)

## Support & Questions

For issues with database setup:
1. Check MySQL error logs: `tail -f /var/log/mysql/error.log`
2. Verify user permissions: `SHOW GRANTS;`
3. Test connection: `mysql -u user -p -h host`
4. Review schema comments in schema.sql

---

**Last Updated:** March 2026
**Version:** 1.0
**Compatible With:** MySQL 5.7+, MariaDB 10.3+

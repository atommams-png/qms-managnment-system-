# ATOM QMS Backend - Setup Guide

## ✅ Prerequisites

Before starting the backend, ensure:
- ✓ MySQL database `atom_qms` is created with all tables
- ✓ Node.js is installed (v14 or higher)
- ✓ npm is installed

## 🚀 Setup Steps

### Step 1: Verify Backend Folder
```bash
cd backend
ls -la
```

You should see:
```
.env
.gitignore
db.js
package.json
README.md
server.js
utils.js
routes/
  ├── admin.js
  ├── attempts.js
  ├── candidates.js
  ├── exams.js
  └── results.js
```

### Step 2: Verify .env File

Check that `.env` contains your database credentials:
```bash
cat .env
```

Expected content:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=12345
DB_NAME=atom_qms
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

### Step 3: Install Dependencies
```bash
npm install
```

Expected output:
```
added XX packages
audited XX packages in Xs
found 0 vulnerabilities
```

### Step 4: Start Backend Server

**Option A: Development mode (with auto-reload)**
```bash
npm run dev
```

**Option B: Production mode**
```bash
npm start
```

### Step 5: Verify Server is Running

You should see:
```
✓ Database connection successful
🚀 ATOM QMS Backend API

Server running on: http://localhost:5000
Environment: development
Database: atom_qms

Health Check: GET /api/health
API Docs: See routes/ folder
```

### Step 6: Test Health Endpoint

In another terminal:
```bash
curl http://localhost:5000/api/health
```

Response:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-03-13T16:30:45.123Z"
}
```

---

## 🧪 Quick Test

### Test Admin Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "username": "admin"
  },
  "message": "Login successful"
}
```

### Test Get All Exams
```bash
curl http://localhost:5000/api/exams
```

Expected response:
```json
{
  "success": true,
  "data": []
}
```

---

## 📁 Backend File Descriptions

| File | Purpose |
|------|---------|
| **server.js** | Main Express app, middleware, routes setup |
| **db.js** | MySQL connection pool configuration |
| **utils.js** | Helper functions (UUID, code generation, etc) |
| **.env** | Database credentials and config |
| **README.md** | API documentation |
| **routes/admin.js** | Login endpoints |
| **routes/exams.js** | Exam CRUD, questions, settings |
| **routes/candidates.js** | Candidate registration |
| **routes/attempts.js** | Exam attempts and answer submission |
| **routes/results.js** | Results calculation and reporting |

---

## 🔗 Connecting from React

Update your React app to use the API:

### Example: Replace localStorage
**Before (localStorage):**
```javascript
import { getExams } from '@/lib/store';
const exams = getExams();
```

**After (API):**
```javascript
const [exams, setExams] = useState([]);

useEffect(() => {
  fetch('http://localhost:5000/api/exams')
    .then(r => r.json())
    .then(data => setExams(data.data));
}, []);
```

### Create API Service File
Create `src/lib/api.js`:
```javascript
const API_URL = 'http://localhost:5000/api';

// Admin
export async function loginAdmin(username, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return res.json();
}

// Exams
export async function getExams() {
  const res = await fetch(`${API_URL}/exams`);
  return res.json();
}

export async function createExam(name, settings) {
  const res = await fetch(`${API_URL}/exams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, settings })
  });
  return res.json();
}

export async function getExamByCode(code) {
  const res = await fetch(`${API_URL}/exams/code/${code}`);
  return res.json();
}

// ... more functions for other endpoints
```

Then in React components:
```javascript
import { getExams, createExam } from '@/lib/api';

// Get exams
const { data: exams } = await getExams();

// Create exam
await createExam('Math 101', { duration: 60, ... });
```

---

## 🔒 Important: Update CORS

If your React app is on a different URL, update `.env`:
```env
# For localhost development
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# For production
CORS_ORIGIN=https://yourdomain.com
```

---

## 📊 Database Verification

Verify all data is being saved:

```bash
# Check admin user
mysql -u root -p12345 code_exam_guard -e "SELECT * FROM admins;"

# Check exams
mysql -u root -p12345 code_exam_guard -e "SELECT * FROM exams;"

# Check questions
mysql -u root -p12345 code_exam_guard -e "SELECT COUNT(*) as total_questions FROM questions;"

# Check candidates
mysql -u root -p12345 code_exam_guard -e "SELECT * FROM candidates;"

# Check exam attempts
mysql -u root -p12345 code_exam_guard -e "SELECT * FROM exam_attempts;"

# Check results
mysql -u root -p12345 code_exam_guard -e "SELECT * FROM exam_results;"
```

---

## 🚨 Common Issues

### "Cannot connect to database"
```bash
# Check MySQL is running
mysql -u root -p12345 -e "SELECT 1;"

# Check .env credentials
cat .env | grep DB_

# Test connection
mysql -h localhost -u root -p12345 code_exam_guard -e "SELECT 1;"
```

### "Port 5000 already in use"
```bash
# Change port in .env
PORT=5001

# Or find and kill process on port 5000
lsof -i :5000
kill -9 <PID>
```

### CORS errors from React
```bash
# Make sure backend is running
curl http://localhost:5000/api/health

# Update CORS_ORIGIN in .env if React is on different URL
CORS_ORIGIN=http://your-react-domain.com
```

### "Cannot find module mysql2"
```bash
npm install mysql2
npm install mysql2/promise
```

---

## ✅ Setup Checklist

- [ ] Backend folder exists with all files
- [ ] .env file has correct database credentials
- [ ] `npm install` completed without errors
- [ ] `npm run dev` or `npm start` shows server running
- [ ] Health check endpoint works: `curl http://localhost:5000/api/health`
- [ ] Admin login works: test with Postman
- [ ] MySQL database has tables with data
- [ ] React app updated to use API endpoints

---

## 🎯 Next Steps

1. **Backend running** ✓
2. Update React app to use API endpoints
3. Test all functionality end-to-end
4. Verify data persists in MySQL
5. Deploy to production

---

## 📞 Support

If you encounter issues:
1. Check MySQL is running: `mysql -u root -p12345 -e "SELECT 1;"`
2. Check server is running: `curl http://localhost:5000/api/health`
3. Check .env variables: `cat .env`
4. Review logs in terminal where server is running

---

**Created:** March 2026
**Version:** 1.0
**Status:** Ready to use

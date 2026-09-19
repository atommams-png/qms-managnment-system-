# ATOM QMS - Backend API

Complete Node.js/Express backend API for saving all exam data to MySQL database.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Verify .env File
Check that `.env` has your database credentials:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=12345
DB_NAME=code_exam_guard
PORT=5000
```

### 3. Start Server
```bash
# Development with auto-reload
npm run dev

# OR production
npm start
```

You should see:
```
✓ Database connection successful
🚀 ATOM QMS Backend API
Server running on: http://localhost:5000
```

### 4. Test Connection
```bash
# In another terminal
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-03-13T..."
}
```

---

## 📚 API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `GET /api/auth/profile/:adminId` - Get admin profile

### Exams
- `GET /api/exams` - Get all exams
- `GET /api/exams/:id` - Get exam with questions
- `GET /api/exams/code/:code` - Get exam by code (for candidates)
- `POST /api/exams` - Create exam
- `PUT /api/exams/:id` - Update exam
- `PATCH /api/exams/:id/toggle` - Toggle exam active status
- `DELETE /api/exams/:id` - Delete exam
- `POST /api/exams/:examId/questions` - Add question
- `PUT /api/exams/:examId/questions/:questionId` - Update question
- `DELETE /api/exams/:examId/questions/:questionId` - Delete question

### Candidates
- `POST /api/candidates` - Register candidate
- `GET /api/candidates/exam/:examId` - Get candidates for exam
- `GET /api/candidates/:id` - Get single candidate
- `DELETE /api/candidates/:id` - Delete candidate

### Exam Attempts
- `POST /api/attempts` - Start exam attempt
- `GET /api/attempts/:id` - Get attempt
- `PUT /api/attempts/:id` - Save answers
- `POST /api/attempts/:id/submit` - Submit exam and calculate result
- `GET /api/attempts/exam/:examId` - Get all attempts for exam

### Results
- `GET /api/results/attempt/:attemptId` - Get result
- `GET /api/results/exam/:examId` - Get all results for exam
- `GET /api/results/candidate/:candidateId` - Get candidate's results
- `GET /api/results/stats/exam/:examId` - Get exam statistics
- `GET /api/results/export/:examId` - Export results as CSV

---

## 📁 Project Structure

```
backend/
├── server.js           # Main Express app
├── db.js             # MySQL connection
├── utils.js          # Helper functions
├── .env              # Database credentials
├── package.json      # Dependencies
│
└── routes/
    ├── admin.js      # Auth routes
    ├── exams.js      # Exam management
    ├── candidates.js # Candidate registration
    ├── attempts.js   # Exam attempts
    └── results.js    # Results & analytics
```

---

## 🔄 Request/Response Format

All responses follow this format:

### Success
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "timestamp": "2026-03-13T..."
}
```

### Error
```json
{
  "error": "Error message",
  "timestamp": "2026-03-13T..."
}
```

---

## 📝 Example API Calls

### Login Admin
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

### Create Exam
```bash
curl -X POST http://localhost:5000/api/exams \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Math Final",
    "settings": {
      "duration": 120,
      "marksPerQuestion": 1,
      "negativeMarks": 0.25,
      "showResult": true,
      "randomOrder": false,
      "fullscreenMode": true,
      "tabSwitchDetection": true,
      "maxTabSwitches": 3,
      "navigationPanel": true,
      "questionTimer": 0
    }
  }'
```

### Start Exam Attempt
```bash
curl -X POST http://localhost:5000/api/attempts \
  -H "Content-Type: application/json" \
  -d '{
    "candidateId": "uuid-here",
    "examId": "exam-uuid-here"
  }'
```

### Save Answers
```bash
curl -X PUT http://localhost:5000/api/attempts/attempt-uuid \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      { "questionId": "q1-uuid", "selectedAnswer": 0 },
      { "questionId": "q2-uuid", "selectedAnswer": 1 },
      { "questionId": "q3-uuid", "selectedAnswer": null }
    ],
    "tabSwitches": 2
  }'
```

### Submit Exam
```bash
curl -X POST http://localhost:5000/api/attempts/attempt-uuid/submit \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      { "questionId": "q1-uuid", "selectedAnswer": 0 },
      { "questionId": "q2-uuid", "selectedAnswer": 1 },
      { "questionId": "q3-uuid", "selectedAnswer": 2 }
    ]
  }'
```

---

## 🧪 Testing Endpoints

Use Postman, Insomnia, or curl to test endpoints.

### Complete Test Flow

1. **Login**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

2. **Create Exam**
```bash
curl -X POST http://localhost:5000/api/exams \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Exam","settings":{"duration":60,"marksPerQuestion":1,"negativeMarks":0}}'
```

3. **Add Question**
```bash
curl -X POST http://localhost:5000/api/exams/EXAM_ID/questions \
  -H "Content-Type: application/json" \
  -d '{"type":"mcq","text":"What is 2+2?","options":["3","4","5","6"],"correctAnswer":1}'
```

4. **Register Candidate**
```bash
curl -X POST http://localhost:5000/api/candidates \
  -H "Content-Type: application/json" \
  -d '{
    "examId":"EXAM_ID",
    "name":"John Doe",
    "email":"john@example.com",
    "usn":"USN001",
    "department":"CS"
  }'
```

5. **Start Attempt**
```bash
curl -X POST http://localhost:5000/api/attempts \
  -H "Content-Type: application/json" \
  -d '{"candidateId":"CANDIDATE_ID","examId":"EXAM_ID"}'
```

---

## 🔒 Security Notes

1. **Environment Variables**: Never commit `.env` file
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Password Hashing**: Use bcrypt for production
   ```bash
   npm install bcrypt
   ```

3. **CORS**: Configure for your frontend URL
   ```env
   CORS_ORIGIN=your-frontend-domain.com
   ```

4. **Authentication**: Add JWT middleware for production
   ```bash
   npm install jsonwebtoken
   ```

---

## 🚨 Troubleshooting

### "Database connection failed"
```bash
# Check MySQL is running
mysql -u root -p12345 -e "SELECT 1;"

# Check database exists
mysql -u root -p12345 -e "SHOW DATABASES;"

# Check tables exist
mysql -u root -p12345 code_exam_guard -e "SHOW TABLES;"
```

### "Cannot find module 'mysql2'"
```bash
npm install
npm install mysql2
```

### "Port 5000 already in use"
```bash
# Change port in .env
PORT=5001

# Or kill the process using port 5000
```

### CORS errors in React
```env
# In backend/.env, update CORS_ORIGIN to your React app URL
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

---

## 📚 Environment Variables

```env
# Database
DB_HOST=localhost              # MySQL host
DB_PORT=3306                  # MySQL port
DB_USER=root                  # MySQL username
DB_PASSWORD=12345             # MySQL password
DB_NAME=code_exam_guard       # Database name

# Server
PORT=5000                     # API server port
NODE_ENV=development          # Environment

# CORS
CORS_ORIGIN=http://localhost:5173   # Frontend URL
```

---

## 🎯 Next Steps

1. **Start the server** with `npm run dev`
2. **Update React** to use API endpoints instead of localStorage
3. **Test all endpoints** with Postman/Insomnia
4. **Deploy** with proper environment configuration

---

**Created:** March 2026
**Version:** 1.0
**Status:** Ready for development

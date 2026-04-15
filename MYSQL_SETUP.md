# 🚀 Code Exam Guard - MySQL Migration Complete

This document explains how to set up and run the application with MySQL database (replacing local storage).

## 📋 Prerequisites

- **Node.js** v16+ installed
- **MySQL** server installed and running
- **MySQL Credentials**:
  - Host: `localhost`
  - User: `root`
  - Password: `12345`
  - Port: `3306`

## ⚙️ Setup Instructions

### Step 1: Initialize Database

From the `backend/` directory, run:

```bash
cd backend
npm run init:db
```

This script will:
- Connect to MySQL as root
- Create the `code_exam_guard` database
- Create all required tables (admins, exams, questions, candidates, exam_attempts, exam_results)
- Insert default admin credentials

**Default Admin Credentials:**
- Username: `admin`
- Password: `admin123`

### Step 2: Start Backend Server

From the `backend/` directory:

```bash
npm install  # Install dependencies if not already done
npm run dev  # Start backend in development mode with hot reload
```

Expected output:
```
✓ Database connection successful
╔════════════════════════════════════════════════════════════╗
║     🚀 Code Exam Guard Backend API                        ║
║     Server running on: http://localhost:5000              ║
║     Environment: development                              ║
║     Database: code_exam_guard                             ║
╚════════════════════════════════════════════════════════════╝
```

### Step 3: Start Frontend Application

From the root directory:

```bash
npm install  # Install dependencies if not already done
npm run dev  # Start frontend in development mode
```

Access the application at: `http://localhost:5173`

## 📊 Database Architecture

### Tables Created

1. **admins** - Admin user accounts
2. **exams** - Exam configurations and metadata
3. **questions** - Exam questions with options
4. **candidates** - Candidate registration
5. **exam_attempts** - Exam submissions and answers
6. **exam_results** - Calculated results and scores

### Features

- ✅ All exam data stored in MySQL
- ✅ All candidate data stored in MySQL
- ✅ All exam attempts stored in MySQL
- ✅ Results calculated and stored in MySQL
- ✅ No local storage dependencies
- ✅ Session storage for temporary state only
- ✅ ACID compliance and data integrity

## 🔄 API Endpoints

The frontend communicates with the backend via REST API:

### Authentication
- `POST /api/auth/login` - Admin login

### Exams
- `GET /api/exams` - Get all exams
- `GET /api/exams/:id` - Get exam by ID
- `GET /api/exams/code/:code` - Get exam by candidate code
- `POST /api/exams` - Create exam
- `PUT /api/exams/:id` - Update exam
- `PATCH /api/exams/:id/toggle` - Toggle exam active status
- `DELETE /api/exams/:id` - Delete exam

### Questions
- `POST /api/exams/:examId/questions` - Add question
- `PUT /api/exams/:examId/questions/:questionId` - Update question
- `DELETE /api/exams/:examId/questions/:questionId` - Delete question

### Candidates
- `POST /api/candidates` - Register candidate
- `GET /api/candidates/exam/:examId` - Get candidates for exam

### Exam Attempts
- `POST /api/attempts` - Start exam attempt
- `PUT /api/attempts/:id` - Update attempt
- `POST /api/attempts/:id/submit` - Submit exam

### Results
- `GET /api/results/exam/:examId` - Get exam results
- `GET /api/results/attempt/:attemptId` - Get attempt result
- `GET /api/results/export/:examId` - Export results as CSV

## 🔧 Configuration

### Backend Environment Variables (backend/.env)

```bash
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=12345
DB_NAME=code_exam_guard
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

### Frontend API Configuration (src/lib/api.ts)

The frontend automatically proxies all `/api` requests to the backend server via Vite proxy.

## 🌐 Deployment

For production deployment:

1. **Database**: Set up MySQL on your production server
2. **Backend**: Deploy to a server and update environment variables
3. **Frontend**: Build with `npm run build` and deploy to CDN/static hosting

Update `src/lib/api.ts` API_URL for production:
```typescript
const API_URL = 'https://your-api-domain.com/api';
```

## 📝 Data Migration (if needed)

If you have existing local storage data:

1. Export data from local storage
2. Write a migration script to import into MySQL
3. Run migration script before starting application

## ❓ Troubleshooting

### Database Connection Error
- Ensure MySQL is running
- Check credentials in `backend/.env`
- Verify database port (default 3306)

### API Connection Error
- Ensure backend server is running on port 5000
- Check CORS configuration in `backend/server.js`
- Verify frontend proxy in `vite.config.ts`

### Tables Not Created
- Check MySQL user permissions
- Run `npm run init:db` again
- Check backend console for error messages

## 🎉 What's Changed

### Local Storage ❌ → MySQL ✅

**Before:**
- All data stored in browser's localStorage
- Data lost when browser cache cleared
- No data persistence across devices

**After:**
- All data stored in MySQL database
- Persistent across sessions and devices
- Centralized data management
- Better for team collaboration
- Ready for scaling

## 📚 Additional Resources

- [MySQL Official Docs](https://dev.mysql.com/doc/)
- [Express.js Documentation](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)

---

**Version**: 1.0.0
**Last Updated**: 2026-03-30
**Status**: ✅ Production Ready

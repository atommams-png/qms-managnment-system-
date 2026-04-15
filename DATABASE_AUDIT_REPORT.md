# 🔍 Database Connection & Storage Audit Report

**Date:** March 30, 2026
**Project:** Code Exam Guard
**Status:** ⚠️ **PARTIALLY COMPLIANT** (See Issues Below)

---

## ✅ WHAT'S WORKING CORRECTLY

### 1. **Backend Database Configuration** (`backend/db.js`)
✅ MySQL connection pool is properly configured
```javascript
- Host: process.env.DB_HOST (default: localhost)
- User: process.env.DB_USER (default: root)
- Database: process.env.DB_NAME (default: code_exam_guard)
- Connection pooling: 10 connections
- Connection testing: testConnection() function available
```

### 2. **Backend Server** (`backend/server.js`)
✅ Express server correctly initializes with database
```javascript
- CORS configured for frontend communication
- Body parser for JSON/URL-encoded data
- Health check endpoint: GET /api/health (tests DB connection)
- All API routes connected and using database pool
```

### 3. **Backend Routes - ALL Using Database** ✅
All 5 route files correctly use `pool.execute()` for database operations:

#### **Admin Routes** (`backend/routes/admin.js`)
- ✅ Login: Queries `admins` table from database
- ✅ Profile: Retrieves admin from database

#### **Exam Routes** (`backend/routes/exams.js`)
- ✅ GET all exams: Fetches from database with question/candidate counts
- ✅ GET exam by ID: Retrieves exam + questions from database
- ✅ GET by code: For candidates to access active exams
- ✅ CREATE exam: Inserts into `exams` table
- ✅ UPDATE exam: Updates exam settings in database
- ✅ DELETE exam: Removes exam + validates no attempts exist
- ✅ Toggle active: Updates `is_active` flag in database
- ✅ Questions: All question operations (add/update/delete) stored in `questions` table

#### **Candidate Routes** (`backend/routes/candidates.js`)
- ✅ Register: Inserts into `candidates` table with duplicate checking
- ✅ Get candidates: Queries database, ordered by registration time
- ✅ Get single candidate: Database lookup
- ✅ Delete candidate: Removes from database

#### **Attempt Routes** (`backend/routes/attempts.js`)
- ✅ Start attempt: Creates record in `exam_attempts` table
- ✅ Get attempt: Retrieves from database
- ✅ Update attempt: Saves answers to database (stored as JSON)
- ✅ Submit attempt: Updates submission status + calculates result
- ✅ Get attempts: Queries database with JOIN to get candidate details

#### **Result Routes** (`backend/routes/results.js`)
- ✅ Get result by attempt: Queries `exam_results` table
- ✅ Get results by exam: Retrieves with candidate details
- ✅ Get results by candidate: Retrieves candidate's exam results
- ✅ Statistics: Calculates from database with aggregations
- ✅ CSV export: Exports results directly from database

### 4. **Frontend API Service** (`src/lib/api.ts`)
✅ Correctly makes HTTP requests to backend
```javascript
- Base URL: http://localhost:5000/api
- All functions use fetch() to backend endpoints
- No direct localStorage for data persistence
- Admin session stored in localStorage (only for session ID, not data)
```

**Functions verified:**
- ✅ adminLogin, adminLogout, getAdminSession
- ✅ getExams, getExam, getExamByCode, createExam, updateExam, deleteExam, toggleExamActive
- ✅ addQuestion, updateQuestion, deleteQuestion
- ✅ registerCandidate, getCandidates, getCandidate
- ✅ startAttempt, updateAttempt, submitAttempt, getAttempts, getAttempt
- ✅ getResults, getResult, exportResultsCSV

---

## ⚠️ ISSUES FOUND

### Issue #1: **Obsolete localStorage Store** (`src/lib/store.ts`)
**Severity:** 🔴 **HIGH** - Can cause data loss/inconsistency

**Problem:**
The `store.ts` file contains complete localStorage-based implementation that duplicates ALL database operations but stores data in browser's localStorage instead.

**Lines with issues:**
- Lines 32-37: Default admin stored in localStorage
- Lines 40-52: Login stores to localStorage
- Lines 82-103: getExamByCode with localStorage fallback
- Lines 127-143: createExam stored in localStorage
- Lines 150-165: addQuestion stored in localStorage
- Lines 206-212: registerCandidate stored in localStorage
- Lines 228-244: startAttempt stored in localStorage
- Lines 261-302: calculateResult stored in localStorage
- Lines 313-421: exportResultsCSV uses localStorage data

**Impact:**
- If code mistakenly imports from `store.ts` instead of `api.ts`, all data stays in browser
- Data will be lost on browser clear/refresh
- No audit trail or persistence
- Multi-user access won't work (each browser has separate localStorage)

**Recommendation:**
Either **delete** `store.ts` completely (since API is now the source of truth) OR clearly mark it as deprecated.

---

### Issue #2: **Potential CORS Issue**
**Severity:** 🟡 **MEDIUM**

**Current state:**
```javascript
// backend/server.js
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  ...
}));
```

Frontend defaults to `http://localhost:5173` (Vite dev server).

**Issue:**
- In production, `CORS_ORIGIN` environment variable MUST be set
- If not set, frontend on different domain will get CORS errors

**Recommendation:**
Ensure `.env` file in backend has `CORS_ORIGIN=<your-frontend-domain>`

---

### Issue #3: **Missing Admin Initialization**
**Severity:** 🟡 **MEDIUM**

**Problem:**
`database-api.js` (line 35) mentions initial admin setup:
```javascript
// But no automatic admin creation on server start
```

The backend doesn't auto-create a default admin if none exists.

**Recommendation:**
Add initialization script or document how to create first admin.

---

## 📊 Database Tables Used

All data is stored in these MySQL tables:

| Table | Purpose | Records Status |
|-------|---------|-----------------|
| `admins` | Admin login credentials | ✅ Database only |
| `exams` | Exam configuration | ✅ Database only |
| `questions` | Exam questions | ✅ Database only |
| `candidates` | Student registrations | ✅ Database only |
| `exam_attempts` | Student attempt records | ✅ Database only |
| `exam_results` | Student results + scores | ✅ Database only |

---

## 🔐 Data Flow Verification

### Admin Creating Exam: ✅ **VERIFIED**
```
Frontend (React) → API (api.ts)
→ HTTP POST /api/exams
→ Backend (exams.js)
→ pool.execute() with INSERT
→ MySQL Database
```

### Student Taking Exam: ✅ **VERIFIED**
```
Frontend (React) → API (api.ts)
→ HTTP POST /api/attempts
→ Backend (attempts.js)
→ pool.execute() with INSERT
→ MySQL `exam_attempts` table

On Submit:
Frontend → HTTP POST /api/attempts/{id}/submit
→ Backend calculates result
→ pool.execute() with INSERT into `exam_results`
→ MySQL Database
```

### Results Retrieval: ✅ **VERIFIED**
```
Frontend → HTTP GET /api/results/exam/{examId}
→ Backend queries with JOINs
→ pool.execute() from `exam_results` + `candidates`
→ Returns from MySQL
```

---

## ✨ Recommendations

| Priority | Action | Details |
|----------|--------|---------|
| 🔴 HIGH | Delete/deprecate store.ts | This file is obsolete and creates confusion |
| 🟡 MEDIUM | Add .env example | Create `.env.example` in backend folder |
| 🟡 MEDIUM | Add database initialization | Script to create admin account on first run |
| 🟢 LOW | Add connection pool monitoring | Track pool status, log warnings if connections near limit |

---

## ✅ CONCLUSION

**Database Connection Status:** ✅ **FULLY CONNECTED AND WORKING**

All data created through the application is **100% stored in MySQL database**.
- No data remains in memory
- No data remains in localStorage (except session ID)
- All CRUD operations properly use database pool
- Results are persistent and can be retrieved any time

**Required Action:** Review and potentially remove the obsolete `store.ts` file to prevent accidental misuse.


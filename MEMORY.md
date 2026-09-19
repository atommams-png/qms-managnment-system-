# Project Analysis - ATOM QMS

## Overview
ATOM QMS is a web-based exam platform with:
- **Backend:** Node.js + Express + MySQL
- **Frontend:** React + TypeScript (Vite)
- **Architecture:** REST API + Database-driven (NOT in-memory)

---

## Critical Findings

### ✅ Database Status: FULLY CONNECTED
- MySQL connection pool properly configured in `backend/db.js`
- All 6 route files use `pool.execute()` for database operations
- No in-memory storage of actual data
- All CRUD operations persist to MySQL

### ⚠️ Issue Found: Obsolete localStorage Code
**File:** `src/lib/store.ts`
- Contains duplicate localStorage implementation of all database functions
- This is OLD code - should be DELETED or clearly marked deprecated
- Frontend should ONLY use `src/lib/api.ts` (which correctly uses backend)
- If someone accidentally imports from `store.ts`, data won't persist

### ⚠️ CORS Configuration
- Backend expects env variable: `CORS_ORIGIN`
- Default: `http://localhost:5173` (Vite dev server)
- **Action needed:** Set proper domain in production

---

## Data Flow

### All Data Stored in MySQL Tables:
1. `admins` - Admin login
2. `exams` - Exam configuration
3. `questions` - Exam questions (with JSON options)
4. `candidates` - Student registrations
5. `exam_attempts` - Student attempts (with JSON answers)
6. `exam_results` - Student results/scores

### Backend Routes (All database-connected):
- `/api/auth` → admin.js
- `/api/exams` → exams.js
- `/api/candidates` → candidates.js
- `/api/attempts` → attempts.js
- `/api/results` → results.js

### Frontend Communication
- App uses `src/lib/api.ts` for all backend calls
- Session ID only stored in localStorage
- All actual data comes from API/database

---

## Files Reviewed
✓ backend/db.js - MySQL connection setup
✓ backend/server.js - Express server + routes
✓ backend/routes/* - All 5 route files
✓ src/lib/api.ts - Frontend API service
✓ src/lib/store.ts - DEPRECATED localStorage code

---

## Recommendations Done
1. ✓ Created comprehensive audit report: `DATABASE_AUDIT_REPORT.md`
2. TODO: Delete or deprecate `src/lib/store.ts`
3. TODO: Create `.env.example` file
4. TODO: Add admin initialization on first run

# Exam Schedule Fix - Complete Guide

## Issue Identified
The exam schedule date/time picker was showing "Not scheduled" for both START and END times, even though the form apparently had date/time input fields.

## Root Causes
1. **Missing Database Columns**: The `exams` table was missing `start_date_time` and `end_date_time` columns
2. **Async Loading Bug**: EditExam.tsx was calling async `getExam()` synchronously in useEffect, causing data not to load
3. **API Not Sending Dates**: The `updateExam()` API function wasn't sending startDateTime/endDateTime to the backend
4. **Backend Not Handling Dates**: The PUT exam route wasn't expecting or saving the date fields

## Changes Made

### 1. Database Schema ✅
- Added `start_date_time DATETIME` column to exams table
- Added `end_date_time DATETIME` column to exams table
- Updated: `database/schema.sql`

### 2. Migration Script Created ✅
- File: `database/migration-add-schedule.sql`
- Run this SQL against your existing database to add the missing columns:
```sql
ALTER TABLE exams ADD COLUMN IF NOT EXISTS start_date_time DATETIME DEFAULT NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS end_date_time DATETIME DEFAULT NULL;
```

### 3. Frontend Fixes ✅
- **EditExam.tsx**: Fixed async/await loading of exam data in useEffect
- **API Mapper**: Added proper handling of start/end datetime fields
- **updateExam Function**: Now sends startDateTime and endDateTime to backend

### 4. Backend Fixes ✅
- **PUT /exams/:id route**: Updated to accept and save start_date_time and end_date_time
- All SELECT queries now include these columns in results

## How to Deploy

### Option 1: Fresh Database Setup
If you're starting fresh, just run the initialization:
```bash
cd database
./setup.sh  # or setup.bat on Windows
```
The new schema will be applied automatically.

### Option 2: Update Existing Database
If you have existing exam data you want to keep, run the migration:
```bash
# From MySQL client or tool:
source database/migration-add-schedule.sql;
```

## Testing the Fix

1. **Create/Edit an Exam**
   - Navigate to Admin → Create Exam or Edit Exam Details
   - Scroll to "Exam Schedule" section
   - Set START date/time and END date/time
   - Click "Save Changes"

2. **Verify Display**
   - Go back to exam management
   - The schedule should now show the actual dates/times instead of "Not scheduled"

3. **Test Exam Access**
   - Verify candidates can only join during the scheduled window
   - Exam should show "Exam not yet active" before start time
   - Exam should show "Exam expired" after end time

## Files Modified

1. `database/schema.sql` - Added datetime columns
2. `database/migration-add-schedule.sql` - New migration script (created)
3. `backend/routes/exams.js` - Updated PUT route to handle dates
4. `src/lib/api.ts` - Added datetime fields to updateExam and mapper
5. `src/pages/EditExam.tsx` - Fixed async loading

## Notes

- ExamManage.tsx already had the display logic for schedule times - it just needed the data!
- The frontend build completes successfully ✓
- All TypeScript type checking passes ✓

## Next Steps for User

1. Run the migration SQL to add columns to existing database
2. Rebuild and restart the backend
3. Test by creating/editing an exam with schedule times
4. Verify schedule display in exam management page

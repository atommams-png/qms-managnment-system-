-- ============================================================
-- MIGRATION: Add exam schedule columns
-- ============================================================
-- This migration adds start_date_time and end_date_time columns 
-- to the exams table to support exam scheduling functionality

-- Check if column exists before adding (MySQL 8.0+)
-- For older MySQL versions, comment these out and uncomment the simple ALTER statements below

-- ALTER TABLE exams ADD COLUMN start_date_time DATETIME DEFAULT NULL COMMENT 'Scheduled start time for exam';
-- ALTER TABLE exams ADD COLUMN end_date_time DATETIME DEFAULT NULL COMMENT 'Scheduled end time for exam';

-- For MySQL versions < 8.0, run these simpler statements:
ALTER TABLE exams ADD COLUMN start_date_time DATETIME;
ALTER TABLE exams ADD COLUMN end_date_time DATETIME;

-- Add comment after creation (optional)
ALTER TABLE exams MODIFY start_date_time DATETIME COMMENT 'Scheduled start time for exam';
ALTER TABLE exams MODIFY end_date_time DATETIME COMMENT 'Scheduled end time for exam';

-- Create index for schedule queries (optional, for performance)
CREATE INDEX idx_schedule ON exams(start_date_time, end_date_time);

-- If the columns already exist, you'll get an error - that's OK, just ignore it
-- To verify migration, run:
-- SELECT id, name, start_date_time, end_date_time FROM exams LIMIT 1;

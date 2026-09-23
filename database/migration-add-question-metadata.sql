-- Migration: Add question metadata fields (marks, section, passage, passage_group_id)
-- Run this on existing databases to add support for reading comprehension questions
-- and additional question metadata.

USE railway;

-- 1. Add new columns to questions table
ALTER TABLE questions 
  ADD COLUMN marks INT NOT NULL DEFAULT 1 COMMENT 'Marks for this question' AFTER option_images,
  ADD COLUMN section VARCHAR(255) COMMENT 'Section/category for this question (e.g., Python, Java)' AFTER marks,
  ADD COLUMN passage LONGTEXT COMMENT 'Reading passage for reading comprehension questions' AFTER section,
  ADD COLUMN passage_group_id VARCHAR(36) COMMENT 'Group ID for linking multiple RC questions to same passage' AFTER passage;

-- 2. Update type ENUM to include reading-comprehension
ALTER TABLE questions 
  MODIFY COLUMN type ENUM('mcq', 'mcq-image', 'true-false', 'reading-comprehension') NOT NULL DEFAULT 'mcq' COMMENT 'Question type';

-- 3. Create index on passage_group_id for efficient RC question grouping
ALTER TABLE questions 
  ADD INDEX idx_passage_group_id (passage_group_id);

-- Migration complete!
-- Verify with: DESCRIBE questions;

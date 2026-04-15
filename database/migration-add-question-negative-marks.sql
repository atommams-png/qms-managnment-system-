-- Migration: Add optional per-question negative marks
-- If negative_marks is NULL, the exam-level negative_marks value will be used.

USE code_exam_guard;

ALTER TABLE questions
  ADD COLUMN negative_marks DECIMAL(5, 2) DEFAULT NULL
  COMMENT 'Optional negative marks for this question (NULL uses exam default)'
  AFTER marks;

-- Verify with: DESCRIBE questions;

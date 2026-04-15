-- ============================================================
-- CODE EXAM GUARD - MySQL Database Schema
-- ============================================================
-- This schema defines all tables required for the exam management system
-- Created: 2026-03-13
-- ============================================================

-- Drop existing tables if they exist (careful in production!)
-- DROP TABLE IF EXISTS exam_results;
-- DROP TABLE IF EXISTS candidate_answers;
-- DROP TABLE IF EXISTS exam_attempts;
-- DROP TABLE IF EXISTS questions;
-- DROP TABLE IF EXISTS candidates;
-- DROP TABLE IF EXISTS exams;
-- DROP TABLE IF EXISTS admins;

-- ============================================================
-- 1. ADMINS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID identifier for admin',
  username VARCHAR(100) NOT NULL UNIQUE COMMENT 'Admin username for login',
  password VARCHAR(255) NOT NULL COMMENT 'Admin password (should be hashed in production)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Admin account creation timestamp',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',

  INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores admin user credentials';

-- ============================================================
-- 2. EXAMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS exams (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID identifier for exam',
  name VARCHAR(255) NOT NULL COMMENT 'Exam name/title',
  code VARCHAR(10) NOT NULL UNIQUE COMMENT 'Unique exam code for candidates to enter',

  -- Exam Settings (JSON object containing all settings)
  duration INT NOT NULL DEFAULT 60 COMMENT 'Exam duration in minutes',
  marks_per_question INT NOT NULL DEFAULT 1 COMMENT 'Marks awarded for each correct answer',
  negative_marks DECIMAL(5, 2) NOT NULL DEFAULT 0 COMMENT 'Negative marks for wrong answers',
  show_result BOOLEAN NOT NULL DEFAULT 1 COMMENT 'Whether to show results to candidates',
  random_order BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Whether to randomize question order',
  fullscreen_mode BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Enforce fullscreen mode during exam',
  tab_switch_detection BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Enable tab switch monitoring',
  max_tab_switches INT NOT NULL DEFAULT 0 COMMENT 'Maximum allowed tab switches (0 = unlimited)',
  navigation_panel BOOLEAN NOT NULL DEFAULT 1 COMMENT 'Show question navigation panel',
  question_timer INT NOT NULL DEFAULT 0 COMMENT 'Time limit per question in seconds (0 = disabled)',

  -- Schedule
  start_date_time DATETIME DEFAULT NULL COMMENT 'Scheduled start time for exam',
  end_date_time DATETIME DEFAULT NULL COMMENT 'Scheduled end time for exam',

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Exam creation timestamp',
  is_active BOOLEAN NOT NULL DEFAULT 1 COMMENT 'Whether exam is active and accepting candidates',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',

  INDEX idx_code (code),
  INDEX idx_is_active (is_active),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores exam information and settings';

-- ============================================================
-- 3. QUESTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID identifier for question',
  exam_id VARCHAR(36) NOT NULL COMMENT 'Foreign key to exams table',
  type ENUM('mcq', 'mcq-image', 'true-false', 'reading-comprehension') NOT NULL DEFAULT 'mcq' COMMENT 'Question type',
  text LONGTEXT NOT NULL COMMENT 'Question text/content',
  image_url LONGTEXT COMMENT 'URL or base64 data URI for question image (optional)',
  correct_answer INT NOT NULL COMMENT 'Index of correct option (0-based)',

  -- Question options storage (JSON array of strings)
  options JSON NOT NULL COMMENT 'Question options stored as JSON array',

  -- Option images storage (JSON array of URLs/base64)
  option_images JSON COMMENT 'Option images stored as JSON array (optional)',

  -- Question metadata
  marks INT NOT NULL DEFAULT 1 COMMENT 'Marks for this question',
  negative_marks DECIMAL(5, 2) DEFAULT NULL COMMENT 'Optional negative marks for this question (NULL uses exam default)',
  section VARCHAR(255) COMMENT 'Section/category for this question (e.g., Python, Java)',
  passage LONGTEXT COMMENT 'Reading passage for reading comprehension questions',
  passage_group_id VARCHAR(36) COMMENT 'Group ID for linking multiple RC questions to same passage',

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Question creation timestamp',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
  display_order INT COMMENT 'Display order of question within exam',

  CONSTRAINT fk_question_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  INDEX idx_exam_id (exam_id),
  INDEX idx_type (type),
  INDEX idx_display_order (exam_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores exam questions with options and images';

-- ============================================================
-- 4. CANDIDATES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS candidates (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID identifier for candidate',
  exam_id VARCHAR(36) NOT NULL COMMENT 'Foreign key to exams table',
  name VARCHAR(255) NOT NULL COMMENT 'Candidate full name',
  email VARCHAR(255) NOT NULL COMMENT 'Candidate email address',
  phone VARCHAR(20) COMMENT 'Candidate phone number',
  college VARCHAR(255) COMMENT 'College/Institution name',
  usn VARCHAR(50) NOT NULL COMMENT 'USN (University Serial Number) or roll number',
  department VARCHAR(100) COMMENT 'Department/Branch',
  section VARCHAR(50) COMMENT 'Section/Division (e.g., A, B)',
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Candidate registration timestamp',

  CONSTRAINT fk_candidate_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  UNIQUE KEY uk_exam_usn_dept (exam_id, usn, department) COMMENT 'Prevent duplicate candidates in same exam',
  INDEX idx_exam_id (exam_id),
  INDEX idx_usn (usn),
  INDEX idx_email (email),
  INDEX idx_registered_at (registered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores candidate registration information';

-- ============================================================
-- 5. EXAM_ATTEMPTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS exam_attempts (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID identifier for attempt',
  candidate_id VARCHAR(36) NOT NULL COMMENT 'Foreign key to candidates table',
  exam_id VARCHAR(36) NOT NULL COMMENT 'Foreign key to exams table',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When candidate started the exam',
  submitted_at TIMESTAMP NULL COMMENT 'When candidate submitted the exam',
  tab_switches INT NOT NULL DEFAULT 0 COMMENT 'Number of tab switches during exam',
  is_submitted BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Whether exam has been submitted',

  -- Answers storage (JSON array of candidate answers)
  -- Structure: [{ "questionId": "...", "selectedAnswer": 0 or null }, ...]
  answers JSON COMMENT 'Candidate answers stored as JSON array',

  CONSTRAINT fk_attempt_candidate FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  INDEX idx_candidate_id (candidate_id),
  INDEX idx_exam_id (exam_id),
  INDEX idx_is_submitted (is_submitted),
  INDEX idx_started_at (started_at),
  UNIQUE KEY uk_candidate_exam (candidate_id, exam_id) COMMENT 'One attempt per candidate per exam'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores exam attempts by candidates';

-- ============================================================
-- 6. EXAM_RESULTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS exam_results (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID identifier for result',
  attempt_id VARCHAR(36) NOT NULL UNIQUE COMMENT 'Foreign key to exam_attempts table',
  candidate_id VARCHAR(36) NOT NULL COMMENT 'Foreign key to candidates table',
  exam_id VARCHAR(36) NOT NULL COMMENT 'Foreign key to exams table',

  -- Question counts
  total_questions INT NOT NULL DEFAULT 0 COMMENT 'Total questions in exam',
  correct_answers INT NOT NULL DEFAULT 0 COMMENT 'Number of correct answers',
  wrong_answers INT NOT NULL DEFAULT 0 COMMENT 'Number of wrong answers',
  unanswered INT NOT NULL DEFAULT 0 COMMENT 'Number of unanswered questions',

  -- Marks calculation
  total_marks INT NOT NULL DEFAULT 0 COMMENT 'Total marks possible',
  obtained_marks DECIMAL(10, 2) NOT NULL DEFAULT 0 COMMENT 'Marks obtained (including negative marks)',
  percentage DECIMAL(5, 2) NOT NULL DEFAULT 0 COMMENT 'Percentage score',

  -- Metadata
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When result was calculated',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',

  CONSTRAINT fk_result_attempt FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
  CONSTRAINT fk_result_candidate FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  CONSTRAINT fk_result_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  INDEX idx_attempt_id (attempt_id),
  INDEX idx_candidate_id (candidate_id),
  INDEX idx_exam_id (exam_id),
  INDEX idx_percentage (percentage),
  INDEX idx_calculated_at (calculated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores calculated exam results for candidates';

-- ============================================================
-- DEFAULT DATA
-- ============================================================

-- Insert default admin user (password: admin123)
-- NOTE: In production, use hashed passwords (bcrypt recommended)
INSERT INTO admins (id, username, password) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'admin', 'admin123')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ============================================================
-- VIEWS (Optional - useful for reporting)
-- ============================================================

-- View for candidate results with candidate details
CREATE OR REPLACE VIEW v_candidate_results AS
SELECT
  r.id,
  r.attempt_id,
  c.id as candidate_id,
  c.name,
  c.email,
  c.usn,
  c.department,
  c.college,
  e.id as exam_id,
  e.name as exam_name,
  e.code as exam_code,
  r.total_questions,
  r.correct_answers,
  r.wrong_answers,
  r.unanswered,
  r.total_marks,
  r.obtained_marks,
  r.percentage,
  r.calculated_at
FROM exam_results r
JOIN candidates c ON r.candidate_id = c.id
JOIN exams e ON r.exam_id = e.id;

-- View for exam statistics
CREATE OR REPLACE VIEW v_exam_statistics AS
SELECT
  e.id,
  e.name,
  e.code,
  COUNT(DISTINCT c.id) as total_candidates,
  COUNT(DISTINCT CASE WHEN ea.is_submitted = 1 THEN ea.id END) as attempts_submitted,
  COUNT(DISTINCT q.id) as total_questions,
  COALESCE(AVG(CASE WHEN r.id IS NOT NULL THEN r.percentage END), 0) as avg_percentage,
  COALESCE(MAX(r.percentage), 0) as max_percentage,
  COALESCE(MIN(r.percentage), 0) as min_percentage,
  e.is_active,
  e.created_at
FROM exams e
LEFT JOIN candidates c ON e.id = c.exam_id
LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
LEFT JOIN questions q ON e.id = q.exam_id
LEFT JOIN exam_results r ON ea.id = r.attempt_id
GROUP BY e.id, e.name, e.code, e.is_active, e.created_at;

-- ============================================================
-- INDEXES SUMMARY
-- ============================================================
-- admins: username lookup
-- exams: code lookup, active status filter, creation date sorting
-- questions: exam lookup, type filtering, display order sorting
-- candidates: exam lookup, registration date sorting
-- exam_attempts: candidate and exam lookups, submission status filtering
-- exam_results: percentage sorting for rankings, date sorting

-- ============================================================
-- END OF SCHEMA
-- ============================================================

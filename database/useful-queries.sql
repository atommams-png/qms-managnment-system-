-- ============================================================
-- USEFUL QUERIES FOR EXAM MANAGEMENT
-- ============================================================
-- This file contains commonly used queries for reporting and analysis

-- ============================================================
-- 1. EXAM MANAGEMENT QUERIES
-- ============================================================

-- Get all active exams with question count
SELECT
  e.id,
  e.name,
  e.code,
  e.duration,
  e.created_at,
  COUNT(q.id) as question_count,
  COUNT(DISTINCT c.id) as registered_candidates
FROM exams e
LEFT JOIN questions q ON e.id = q.exam_id
LEFT JOIN candidates c ON e.id = c.exam_id
WHERE e.is_active = 1
GROUP BY e.id
ORDER BY e.created_at DESC;

-- Get exam by code with full details
SELECT
  e.*,
  COUNT(DISTINCT q.id) as question_count,
  COUNT(DISTINCT c.id) as candidate_count
FROM exams e
LEFT JOIN questions q ON e.id = q.exam_id
LEFT JOIN candidates c ON e.id = c.exam_id
WHERE e.code = 'MATH101'
GROUP BY e.id;

-- ============================================================
-- 2. CANDIDATE REGISTRATION QUERIES
-- ============================================================

-- Get all candidates for a specific exam
SELECT
  c.*,
  COALESCE(r.percentage, 'Not Taken') as score_percentage,
  COALESCE(r.obtained_marks, 0) as marks_obtained
FROM candidates c
LEFT JOIN exam_results r ON c.id = r.candidate_id
WHERE c.exam_id = '550e8400-e29b-41d4-a716-446655440002'
ORDER BY c.registered_at DESC;

-- Check for duplicate candidates in an exam
SELECT
  exam_id,
  usn,
  department,
  COUNT(*) as duplicate_count,
  GROUP_CONCAT(name) as candidate_names
FROM candidates
WHERE exam_id = '550e8400-e29b-41d4-a716-446655440002'
GROUP BY exam_id, usn, department
HAVING COUNT(*) > 1;

-- Find candidates by email or USN
SELECT * FROM candidates
WHERE email = 'john.doe@example.com'
   OR usn = 'USN001';

-- ============================================================
-- 3. EXAM ATTEMPT & RESULTS QUERIES
-- ============================================================

-- Get all exam attempts for an exam with candidate details
SELECT
  ea.id as attempt_id,
  c.name as candidate_name,
  c.usn,
  c.department,
  e.name as exam_name,
  ea.started_at,
  ea.submitted_at,
  CASE WHEN ea.is_submitted = 1 THEN 'Submitted' ELSE 'In Progress' END as status,
  TIMESTAMPDIFF(MINUTE, ea.started_at, COALESCE(ea.submitted_at, NOW())) as duration_minutes,
  ea.tab_switches
FROM exam_attempts ea
JOIN candidates c ON ea.candidate_id = c.id
JOIN exams e ON ea.exam_id = e.id
WHERE ea.exam_id = '550e8400-e29b-41d4-a716-446655440002'
ORDER BY ea.started_at DESC;

-- Get exam results ranked by percentage
SELECT
  c.name,
  c.usn,
  c.email,
  c.department,
  r.total_marks,
  r.obtained_marks,
  r.percentage,
  RANK() OVER (ORDER BY r.percentage DESC) as rank,
  r.correct_answers,
  r.wrong_answers,
  r.unanswered
FROM exam_results r
JOIN candidates c ON r.candidate_id = c.id
WHERE r.exam_id = '550e8400-e29b-41d4-a716-446655440002'
ORDER BY r.percentage DESC;

-- Get statistics for a specific exam
SELECT
  e.name as exam_name,
  e.code,
  COUNT(DISTINCT r.candidate_id) as candidates_appeared,
  ROUND(AVG(r.percentage), 2) as avg_percentage,
  MAX(r.percentage) as highest_percentage,
  MIN(r.percentage) as lowest_percentage,
  ROUND(AVG(r.correct_answers), 2) as avg_correct,
  ROUND(AVG(r.wrong_answers), 2) as avg_wrong,
  ROUND(AVG(r.unanswered), 2) as avg_unanswered,
  SUM(CASE WHEN r.percentage >= 40 THEN 1 ELSE 0 END) as passed_count,
  SUM(CASE WHEN r.percentage < 40 THEN 1 ELSE 0 END) as failed_count
FROM exam_results r
JOIN exams e ON r.exam_id = e.id
WHERE e.id = '550e8400-e29b-41d4-a716-446655440002'
GROUP BY e.id, e.name, e.code;

-- ============================================================
-- 4. QUESTION ANALYSIS QUERIES
-- ============================================================

-- Get all questions for a specific exam
SELECT
  q.id,
  q.display_order,
  q.type,
  SUBSTRING(q.text, 1, 100) as question_preview,
  JSON_ARRAY_LENGTH(q.options) as option_count,
  q.correct_answer,
  q.created_at
FROM questions q
WHERE q.exam_id = '550e8400-e29b-41d4-a716-446655440002'
ORDER BY q.display_order;

-- Analyze question difficulty (by answer distribution)
SELECT
  q.id,
  SUBSTRING(q.text, 1, 80) as question_text,
  q.correct_answer,
  SUM(CASE WHEN JSON_EXTRACT(ea.answers, CONCAT('$[?(@.questionId == "', q.id, '")]')) IS NOT NULL THEN 1 ELSE 0 END) as total_attempts,
  SUM(CASE WHEN JSON_EXTRACT(ea.answers, CONCAT('$[?(@.questionId == "', q.id, '" && @.selectedAnswer == ', q.correct_answer, ')]')) IS NOT NULL THEN 1 ELSE 0 END) as correct_count
FROM questions q
LEFT JOIN exam_attempts ea ON q.exam_id = ea.exam_id AND ea.is_submitted = 1
WHERE q.exam_id = '550e8400-e29b-41d4-a716-446655440002'
GROUP BY q.id, q.text, q.correct_answer;

-- ============================================================
-- 5. CANDIDATE PERFORMANCE QUERIES
-- ============================================================

-- Get a candidate's exam history
SELECT
  e.name as exam_name,
  e.code,
  ea.started_at,
  ea.submitted_at,
  r.total_marks,
  r.obtained_marks,
  r.percentage,
  r.correct_answers,
  r.wrong_answers,
  r.unanswered
FROM exam_attempts ea
JOIN exams e ON ea.exam_id = e.id
LEFT JOIN exam_results r ON ea.id = r.attempt_id
WHERE ea.candidate_id = '550e8400-e29b-41d4-a716-446655440101'
ORDER BY ea.started_at DESC;

-- Find high performers (90%+ score)
SELECT
  c.name,
  c.usn,
  c.email,
  c.department,
  e.name as exam_name,
  r.percentage,
  r.obtained_marks,
  r.total_marks
FROM exam_results r
JOIN candidates c ON r.candidate_id = c.id
JOIN exams e ON r.exam_id = e.id
WHERE r.percentage >= 90
ORDER BY r.percentage DESC;

-- Find candidates who exceeded tab switch limit
SELECT
  c.name,
  c.usn,
  e.name as exam_name,
  e.max_tab_switches,
  ea.tab_switches,
  ea.started_at,
  ea.submitted_at
FROM exam_attempts ea
JOIN candidates c ON ea.candidate_id = c.id
JOIN exams e ON ea.exam_id = e.id
WHERE ea.tab_switches > e.max_tab_switches
  AND e.tab_switch_detection = 1
  AND ea.is_submitted = 1;

-- ============================================================
-- 6. TIME-BASED ANALYTICAL QUERIES
-- ============================================================

-- Get registrations over time
SELECT
  DATE(registered_at) as registration_date,
  exam_id,
  COUNT(*) as registrations
FROM candidates
GROUP BY DATE(registered_at), exam_id
ORDER BY registration_date DESC;

-- Get exam attempts timeline
SELECT
  DATE(started_at) as attempt_date,
  exam_id,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN is_submitted = 1 THEN 1 ELSE 0 END) as submitted_attempts
FROM exam_attempts
GROUP BY DATE(started_at), exam_id
ORDER BY attempt_date DESC;

-- ============================================================
-- 7. DATA EXPORT QUERIES
-- ============================================================

-- Export results as CSV (candidate results summary)
SELECT
  c.name,
  c.email,
  c.usn,
  c.department,
  c.college,
  r.total_marks,
  r.obtained_marks,
  r.percentage,
  r.correct_answers,
  r.wrong_answers,
  r.unanswered,
  r.calculated_at
FROM exam_results r
JOIN candidates c ON r.candidate_id = c.id
WHERE r.exam_id = '550e8400-e29b-41d4-a716-446655440002'
ORDER BY r.percentage DESC;

-- ============================================================
-- 8. ADMINISTRATIVE QUERIES
-- ============================================================

-- Count exams by status
SELECT
  is_active,
  COUNT(*) as exam_count,
  SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count
FROM exams
GROUP BY is_active;

-- Get database size information
SELECT
  table_name,
  ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
FROM information_schema.TABLES
WHERE table_schema = DATABASE()
ORDER BY (data_length + index_length) DESC;

-- Most recent activity
SELECT
  'Admin Login' as activity_type,
  MAX(updated_at) as last_activity
FROM admins
UNION ALL
SELECT
  'Exam Created',
  MAX(created_at)
FROM exams
UNION ALL
SELECT
  'Exam Attempt',
  MAX(submitted_at)
FROM exam_attempts
WHERE is_submitted = 1
UNION ALL
SELECT
  'Candidate Registered',
  MAX(registered_at)
FROM candidates;

-- ============================================================
-- END OF USEFUL QUERIES
-- ============================================================

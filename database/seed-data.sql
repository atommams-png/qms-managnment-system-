-- ============================================================
-- SAMPLE DATA FOR DEVELOPMENT/TESTING
-- ============================================================
-- This file contains sample data for testing the application
-- DO NOT use in production - only for development

-- ============================================================
-- Sample Exam
-- ============================================================
INSERT INTO exams (
  id, name, code, duration, marks_per_question, negative_marks,
  show_result, random_order, fullscreen_mode, tab_switch_detection,
  max_tab_switches, navigation_panel, question_timer, is_active
) VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  'Mathematics Final Exam',
  'MATH101',
  120,
  1,
  0.25,
  1,
  0,
  1,
  1,
  3,
  1,
  0,
  1
);

INSERT INTO exams (
  id, name, code, duration, marks_per_question, negative_marks,
  show_result, random_order, fullscreen_mode, tab_switch_detection,
  max_tab_switches, navigation_panel, question_timer, is_active
) VALUES (
  '550e8400-e29b-41d4-a716-446655440003',
  'Science Mid-Semester',
  'SCI201',
  90,
  2,
  0.5,
  1,
  1,
  0,
  0,
  0,
  1,
  30,
  1
);

-- ============================================================
-- Sample Questions for Math Exam
-- ============================================================
INSERT INTO questions (
  id, exam_id, type, text, image_url, options, correct_answer, display_order
) VALUES (
  '550e8400-e29b-41d4-a716-446655440011',
  '550e8400-e29b-41d4-a716-446655440002',
  'mcq',
  'What is 2 + 2?',
  NULL,
  '["3", "4", "5", "6"]',
  1,
  1
);

INSERT INTO questions (
  id, exam_id, type, text, image_url, options, correct_answer, display_order
) VALUES (
  '550e8400-e29b-41d4-a716-446655440012',
  '550e8400-e29b-41d4-a716-446655440002',
  'mcq',
  'What is the square root of 144?',
  NULL,
  '["10", "12", "14", "16"]',
  1,
  2
);

INSERT INTO questions (
  id, exam_id, type, text, options, correct_answer, display_order
) VALUES (
  '550e8400-e29b-41d4-a716-446655440013',
  '550e8400-e29b-41d4-a716-446655440002',
  'true-false',
  'The sum of angles in a triangle is 180 degrees.',
  '["True", "False"]',
  0,
  3
);

-- ============================================================
-- Sample Questions for Science Exam
-- ============================================================
INSERT INTO questions (
  id, exam_id, type, text, options, correct_answer, display_order
) VALUES (
  '550e8400-e29b-41d4-a716-446655440021',
  '550e8400-e29b-41d4-a716-446655440003',
  'mcq',
  'Which element has the atomic number 6?',
  '["Oxygen", "Carbon", "Nitrogen", "Helium"]',
  1,
  1
);

INSERT INTO questions (
  id, exam_id, type, text, options, correct_answer, display_order
) VALUES (
  '550e8400-e29b-41d4-a716-446655440022',
  '550e8400-e29b-41d4-a716-446655440003',
  'mcq',
  'What is the chemical formula for water?',
  '["H2O", "CO2", "O2", "N2"]',
  0,
  2
);

-- ============================================================
-- Sample Candidates
-- ============================================================
INSERT INTO candidates (
  id, exam_id, name, email, phone, college, usn, department, registered_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440101',
  '550e8400-e29b-41d4-a716-446655440002',
  'John Doe',
  'john.doe@example.com',
  '9876543210',
  'ABC Institute',
  'USN001',
  'Computer Science',
  NOW()
);

INSERT INTO candidates (
  id, exam_id, name, email, phone, college, usn, department, registered_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440102',
  '550e8400-e29b-41d4-a716-446655440002',
  'Jane Smith',
  'jane.smith@example.com',
  '9876543211',
  'ABC Institute',
  'USN002',
  'Computer Science',
  NOW()
);

INSERT INTO candidates (
  id, exam_id, name, email, phone, college, usn, department, registered_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440103',
  '550e8400-e29b-41d4-a716-446655440003',
  'Bob Wilson',
  'bob.wilson@example.com',
  '9876543212',
  'XYZ College',
  'USN003',
  'Mechanical Engineering',
  NOW()
);

-- ============================================================
-- Sample Exam Attempts (without submissions)
-- ============================================================
INSERT INTO exam_attempts (
  id, candidate_id, exam_id, answers, tab_switches, is_submitted, submitted_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440201',
  '550e8400-e29b-41d4-a716-446655440101',
  '550e8400-e29b-41d4-a716-446655440002',
  '[{"questionId":"550e8400-e29b-41d4-a716-446655440011","selectedAnswer":1},
    {"questionId":"550e8400-e29b-41d4-a716-446655440012","selectedAnswer":1},
    {"questionId":"550e8400-e29b-41d4-a716-446655440013","selectedAnswer":0}]',
  0,
  1,
  NOW()
);

INSERT INTO exam_attempts (
  id, candidate_id, exam_id, answers, tab_switches, is_submitted, submitted_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440202',
  '550e8400-e29b-41d4-a716-446655440102',
  '550e8400-e29b-41d4-a716-446655440002',
  '[{"questionId":"550e8400-e29b-41d4-a716-446655440011","selectedAnswer":0},
    {"questionId":"550e8400-e29b-41d4-a716-446655440012","selectedAnswer":1},
    {"questionId":"550e8400-e29b-41d4-a716-446655440013","selectedAnswer":null}]',
  2,
  1,
  NOW()
);

-- ============================================================
-- Sample Results
-- ============================================================
INSERT INTO exam_results (
  id, attempt_id, candidate_id, exam_id, total_questions, correct_answers,
  wrong_answers, unanswered, total_marks, obtained_marks, percentage
) VALUES (
  '550e8400-e29b-41d4-a716-446655440301',
  '550e8400-e29b-41d4-a716-446655440201',
  '550e8400-e29b-41d4-a716-446655440101',
  '550e8400-e29b-41d4-a716-446655440002',
  3,
  3,
  0,
  0,
  3,
  3,
  100
);

INSERT INTO exam_results (
  id, attempt_id, candidate_id, exam_id, total_questions, correct_answers,
  wrong_answers, unanswered, total_marks, obtained_marks, percentage
) VALUES (
  '550e8400-e29b-41d4-a716-446655440302',
  '550e8400-e29b-41d4-a716-446655440202',
  '550e8400-e29b-41d4-a716-446655440102',
  '550e8400-e29b-41d4-a716-446655440002',
  3,
  1,
  1,
  1,
  3,
  0.75,
  25
);

-- ============================================================
-- END OF SAMPLE DATA
-- ============================================================

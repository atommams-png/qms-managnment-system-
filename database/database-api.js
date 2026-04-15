// ============================================================
// DATABASE CONNECTION & API SETUP EXAMPLE
// ============================================================
// This file demonstrates how to connect to MySQL and set up
// a basic Express.js API. Place this in your backend project.

/**
 * Installation:
 * npm install express mysql2 dotenv cors body-parser
 */

// ============================================================
// 1. DATABASE CONNECTION SETUP
// ============================================================

const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'code_exam_guard',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableInsecureAuth: false, // Set to true if using old MySQL clients
  timezone: '+00:00' // UTC timezone
});

// Test connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✓ MySQL connection successful');
    connection.release();
  } catch (error) {
    console.error('✗ MySQL connection failed:', error.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };

// ============================================================
// 2. EXAMPLE API ENDPOINTS (store.ts migrations)
// ============================================================

// ============================================================
// ADMIN ENDPOINTS
// ============================================================

/**
 * Admin Login
 * POST /api/auth/login
 */
async function adminLogin(username, password) {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username FROM admins WHERE username = ? AND password = ?',
      [username, password]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

/**
 * Create Admin (for initial setup)
 * POST /api/auth/register
 */
async function createAdmin(username, password) {
  try {
    const id = generateUUID();
    await pool.execute(
      'INSERT INTO admins (id, username, password) VALUES (?, ?, ?)',
      [id, username, password]
    );
    return { id, username };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('Username already exists');
    }
    throw error;
  }
}

// ============================================================
// EXAM ENDPOINTS
// ============================================================

/**
 * Get All Exams
 * GET /api/exams
 */
async function getExams() {
  try {
    const [exams] = await pool.execute(`
      SELECT e.*,
             COUNT(DISTINCT q.id) as question_count,
             COUNT(DISTINCT c.id) as candidate_count
      FROM exams e
      LEFT JOIN questions q ON e.id = q.exam_id
      LEFT JOIN candidates c ON e.id = c.exam_id
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `);
    return exams;
  } catch (error) {
    console.error('Get exams error:', error);
    throw error;
  }
}

/**
 * Get Single Exam
 * GET /api/exams/:id
 */
async function getExam(examId) {
  try {
    const [exams] = await pool.execute(
      'SELECT * FROM exams WHERE id = ?',
      [examId]
    );
    return exams[0] || null;
  } catch (error) {
    console.error('Get exam error:', error);
    throw error;
  }
}

/**
 * Get Exam by Code
 * GET /api/exams/code/:code
 */
async function getExamByCode(code) {
  try {
    const [exams] = await pool.execute(
      'SELECT * FROM exams WHERE code = ? AND is_active = 1',
      [code]
    );
    return exams[0] || null;
  } catch (error) {
    console.error('Get exam by code error:', error);
    throw error;
  }
}

/**
 * Create Exam
 * POST /api/exams
 */
async function createExam(name, settings) {
  try {
    const id = generateUUID();
    const code = generateCode();

    await pool.execute(
      `INSERT INTO exams (
        id, name, code, duration, marks_per_question, negative_marks,
        show_result, random_order, fullscreen_mode, tab_switch_detection,
        max_tab_switches, navigation_panel, question_timer, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id, name, code,
        settings.duration, settings.marksPerQuestion, settings.negativeMarks,
        settings.showResult ? 1 : 0,
        settings.randomOrder ? 1 : 0,
        settings.fullscreenMode ? 1 : 0,
        settings.tabSwitchDetection ? 1 : 0,
        settings.maxTabSwitches,
        settings.navigationPanel ? 1 : 0,
        settings.questionTimer
      ]
    );

    return { id, name, code, ...settings };
  } catch (error) {
    console.error('Create exam error:', error);
    throw error;
  }
}

/**
 * Update Exam
 * PUT /api/exams/:id
 */
async function updateExam(examId, updates) {
  try {
    const setClauses = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      const dbKey = camelCaseToSnakeCase(key);
      if (typeof updates[key] === 'boolean') {
        setClauses.push(`${dbKey} = ?`);
        values.push(updates[key] ? 1 : 0);
      } else {
        setClauses.push(`${dbKey} = ?`);
        values.push(updates[key]);
      }
    });

    values.push(examId);

    const query = `UPDATE exams SET ${setClauses.join(', ')} WHERE id = ?`;
    await pool.execute(query, values);

    return getExam(examId);
  } catch (error) {
    console.error('Update exam error:', error);
    throw error;
  }
}

/**
 * Delete Exam
 * DELETE /api/exams/:id
 */
async function deleteExam(examId) {
  try {
    await pool.execute('DELETE FROM exams WHERE id = ?', [examId]);
    return { success: true };
  } catch (error) {
    console.error('Delete exam error:', error);
    throw error;
  }
}

/**
 * Toggle Exam Active Status
 * PATCH /api/exams/:id/toggle
 */
async function toggleExamActive(examId) {
  try {
    await pool.execute(
      'UPDATE exams SET is_active = !is_active WHERE id = ?',
      [examId]
    );
    return getExam(examId);
  } catch (error) {
    console.error('Toggle exam error:', error);
    throw error;
  }
}

// ============================================================
// QUESTION ENDPOINTS
// ============================================================

/**
 * Add Question
 * POST /api/exams/:examId/questions
 */
async function addQuestion(examId, questionData) {
  try {
    const id = generateUUID();
    const {
      type, text, imageUrl, options, correctAnswer, optionImages
    } = questionData;

    // Get max display order
    const [orderResult] = await pool.execute(
      'SELECT MAX(display_order) as max_order FROM questions WHERE exam_id = ?',
      [examId]
    );
    const displayOrder = (orderResult[0].max_order || 0) + 1;

    await pool.execute(
      `INSERT INTO questions (
        id, exam_id, type, text, image_url, options, correct_answer,
        option_images, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, examId, type, text, imageUrl || null,
        JSON.stringify(options), correctAnswer,
        optionImages ? JSON.stringify(optionImages) : null,
        displayOrder
      ]
    );

    return { id, examId, type, text, imageUrl, options, correctAnswer, optionImages };
  } catch (error) {
    console.error('Add question error:', error);
    throw error;
  }
}

/**
 * Get Questions for Exam
 * GET /api/exams/:examId/questions
 */
async function getQuestions(examId) {
  try {
    const [questions] = await pool.execute(
      'SELECT * FROM questions WHERE exam_id = ? ORDER BY display_order',
      [examId]
    );

    // Parse JSON fields
    return questions.map(q => ({
      ...q,
      options: JSON.parse(q.options),
      optionImages: q.option_images ? JSON.parse(q.option_images) : undefined
    }));
  } catch (error) {
    console.error('Get questions error:', error);
    throw error;
  }
}

/**
 * Update Question
 * PUT /api/exams/:examId/questions/:questionId
 */
async function updateQuestion(examId, questionId, questionData) {
  try {
    const {
      type, text, imageUrl, options, correctAnswer, optionImages
    } = questionData;

    await pool.execute(
      `UPDATE questions SET
        type = ?, text = ?, image_url = ?, options = ?,
        correct_answer = ?, option_images = ?
      WHERE id = ? AND exam_id = ?`,
      [
        type, text, imageUrl || null, JSON.stringify(options),
        correctAnswer, optionImages ? JSON.stringify(optionImages) : null,
        questionId, examId
      ]
    );

    return { id: questionId, examId, type, text, imageUrl, options, correctAnswer, optionImages };
  } catch (error) {
    console.error('Update question error:', error);
    throw error;
  }
}

/**
 * Delete Question
 * DELETE /api/exams/:examId/questions/:questionId
 */
async function deleteQuestion(examId, questionId) {
  try {
    await pool.execute(
      'DELETE FROM questions WHERE id = ? AND exam_id = ?',
      [questionId, examId]
    );
    return { success: true };
  } catch (error) {
    console.error('Delete question error:', error);
    throw error;
  }
}

// ============================================================
// CANDIDATE ENDPOINTS
// ============================================================

/**
 * Register Candidate
 * POST /api/candidates
 */
async function registerCandidate(candidateData) {
  try {
    const id = generateUUID();
    const {
      examId, name, email, phone, college, usn, department
    } = candidateData;

    // Check for duplicates
    const [existing] = await pool.execute(
      'SELECT id FROM candidates WHERE exam_id = ? AND usn = ? AND department = ?',
      [examId, usn, department]
    );

    if (existing.length > 0) {
      throw new Error('Duplicate candidate');
    }

    await pool.execute(
      `INSERT INTO candidates (
        id, exam_id, name, email, phone, college, usn, department
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, examId, name, email, phone || null, college || null, usn, department]
    );

    return { id, examId, name, email, phone, college, usn, department };
  } catch (error) {
    console.error('Register candidate error:', error);
    throw error;
  }
}

/**
 * Get Candidates for Exam
 * GET /api/exams/:examId/candidates
 */
async function getCandidates(examId) {
  try {
    const [candidates] = await pool.execute(
      'SELECT * FROM candidates WHERE exam_id = ? ORDER BY registered_at DESC',
      [examId]
    );
    return candidates;
  } catch (error) {
    console.error('Get candidates error:', error);
    throw error;
  }
}

// ============================================================
// EXAM ATTEMPT ENDPOINTS
// ============================================================

/**
 * Start Exam Attempt
 * POST /api/attempts
 */
async function startAttempt(candidateId, examId) {
  try {
    const id = generateUUID();

    await pool.execute(
      `INSERT INTO exam_attempts (
        id, candidate_id, exam_id, answers, tab_switches, is_submitted
      ) VALUES (?, ?, ?, '[]', 0, 0)`,
      [id, candidateId, examId]
    );

    return { id, candidateId, examId, answers: [], tabSwitches: 0, isSubmitted: false };
  } catch (error) {
    console.error('Start attempt error:', error);
    throw error;
  }
}

/**
 * Update Attempt (save answers)
 * PUT /api/attempts/:attemptId
 */
async function updateAttempt(attemptId, answers, tabSwitches = null) {
  try {
    const updateClauses = ['answers = ?'];
    const values = [JSON.stringify(answers)];

    if (tabSwitches !== null) {
      updateClauses.push('tab_switches = ?');
      values.push(tabSwitches);
    }

    values.push(attemptId);

    const query = `UPDATE exam_attempts SET ${updateClauses.join(', ')} WHERE id = ?`;
    await pool.execute(query, values);

    return { attemptId, answers, tabSwitches };
  } catch (error) {
    console.error('Update attempt error:', error);
    throw error;
  }
}

/**
 * Submit Exam Attempt
 * POST /api/attempts/:attemptId/submit
 */
async function submitAttempt(attemptId) {
  try {
    await pool.execute(
      'UPDATE exam_attempts SET is_submitted = 1, submitted_at = NOW() WHERE id = ?',
      [attemptId]
    );

    // Calculate result automatically
    const [attempt] = await pool.execute(
      'SELECT * FROM exam_attempts WHERE id = ?',
      [attemptId]
    );

    const result = await calculateResult(attemptId);
    return result;
  } catch (error) {
    console.error('Submit attempt error:', error);
    throw error;
  }
}

// ============================================================
// RESULT ENDPOINTS
// ============================================================

/**
 * Calculate Result
 * POST /api/results/:attemptId
 */
async function calculateResult(attemptId) {
  try {
    // Get attempt with exam questions
    const [attempts] = await pool.execute(
      `SELECT ea.*, e.marks_per_question, e.negative_marks
       FROM exam_attempts ea
       JOIN exams e ON ea.exam_id = e.id
       WHERE ea.id = ?`,
      [attemptId]
    );

    if (attempts.length === 0) {
      throw new Error('Attempt not found');
    }

    const attempt = attempts[0];
    const answers = JSON.parse(attempt.answers);

    // Get all questions for the exam
    const [questions] = await pool.execute(
      'SELECT id, correct_answer FROM questions WHERE exam_id = ?',
      [attempt.exam_id]
    );

    // Calculate scores
    let correct = 0, wrong = 0, unanswered = 0;

    questions.forEach(question => {
      const answer = answers.find(a => a.questionId === question.id);
      if (!answer || answer.selectedAnswer === null) {
        unanswered++;
      } else if (answer.selectedAnswer === question.correct_answer) {
        correct++;
      } else {
        wrong++;
      }
    });

    const totalMarks = questions.length * attempt.marks_per_question;
    const obtainedMarks = Math.max(
      0,
      (correct * attempt.marks_per_question) - (wrong * attempt.negative_marks)
    );
    const percentage = Math.round((obtainedMarks / totalMarks) * 100);

    // Save result
    const resultId = generateUUID();
    await pool.execute(
      `INSERT INTO exam_results (
        id, attempt_id, candidate_id, exam_id, total_questions,
        correct_answers, wrong_answers, unanswered, total_marks,
        obtained_marks, percentage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resultId, attemptId, attempt.candidate_id, attempt.exam_id,
        questions.length, correct, wrong, unanswered,
        totalMarks, obtainedMarks, percentage
      ]
    );

    return {
      attemptId,
      candidateId: attempt.candidate_id,
      examId: attempt.exam_id,
      totalQuestions: questions.length,
      correctAnswers: correct,
      wrongAnswers: wrong,
      unanswered,
      totalMarks,
      obtainedMarks,
      percentage
    };
  } catch (error) {
    console.error('Calculate result error:', error);
    throw error;
  }
}

/**
 * Get Results for Exam
 * GET /api/exams/:examId/results
 */
async function getResults(examId) {
  try {
    const [results] = await pool.execute(
      `SELECT r.*, c.name, c.usn, c.email, c.department
       FROM exam_results r
       JOIN candidates c ON r.candidate_id = c.id
       WHERE r.exam_id = ?
       ORDER BY r.percentage DESC`,
      [examId]
    );
    return results;
  } catch (error) {
    console.error('Get results error:', error);
    throw error;
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function camelCaseToSnakeCase(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Connection
  pool,
  testConnection,

  // Auth
  adminLogin,
  createAdmin,

  // Exams
  getExams,
  getExam,
  getExamByCode,
  createExam,
  updateExam,
  deleteExam,
  toggleExamActive,

  // Questions
  addQuestion,
  getQuestions,
  updateQuestion,
  deleteQuestion,

  // Candidates
  registerCandidate,
  getCandidates,

  // Attempts
  startAttempt,
  updateAttempt,
  submitAttempt,

  // Results
  calculateResult,
  getResults,

  // Utilities
  generateUUID,
  generateCode
};

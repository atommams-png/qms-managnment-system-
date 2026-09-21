// ============================================================
// EXAM ATTEMPT ROUTES
// ============================================================

import express from 'express';
import pool from '../db.js';
import { generateUUID } from '../utils.js';

const router = express.Router();
let hasQuestionNegativeMarksColumn;

const supportsQuestionNegativeMarks = async () => {
  if (hasQuestionNegativeMarksColumn !== undefined) {
    return hasQuestionNegativeMarksColumn;
  }

  const [rows] = await pool.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'questions'
       AND COLUMN_NAME = 'negative_marks'
     LIMIT 1`
  );

  hasQuestionNegativeMarksColumn = rows.length > 0;
  return hasQuestionNegativeMarksColumn;
};

const safeJsonParse = (value, fallback = []) => {
  if (value == null) return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

// ============================================================
// START OR RESUME EXAM ATTEMPT
// ============================================================
router.post('/', async (req, res) => {
  try {
    const { candidateId, examId } = req.body;

    if (!candidateId || !examId) {
      return res.status(400).json({ error: 'Candidate ID and Exam ID required' });
    }

    // Check if already attempted
    const [existing] = await pool.execute(
      'SELECT * FROM exam_attempts WHERE candidate_id = ? AND exam_id = ?',
      [candidateId, examId]
    );

    if (existing.length > 0) {
      const attempt = existing[0];
      if (attempt.is_submitted) {
        return res.status(400).json({ error: 'Candidate has already submitted this exam' });
      }

      // If not submitted, allow resuming without losing access
      attempt.answers = safeJsonParse(attempt.answers, []);
      return res.json({
        success: true,
        resumed: true,
        data: {
          id: attempt.id,
          candidateId: attempt.candidate_id,
          examId: attempt.exam_id,
          answers: attempt.answers,
          tabSwitches: attempt.tab_switches,
          isSubmitted: false,
          startedAt: attempt.started_at
        },
        message: 'Exam attempt resumed'
      });
    }

    const id = generateUUID();

    await pool.execute(
      `INSERT INTO exam_attempts (
        id, candidate_id, exam_id, answers, tab_switches, is_submitted
      ) VALUES (?, ?, ?, '[]', 0, 0)`,
      [id, candidateId, examId]
    );

    res.json({
      success: true,
      data: {
        id,
        candidateId,
        examId,
        answers: [],
        tabSwitches: 0,
        isSubmitted: false,
        startedAt: new Date().toISOString()
      },
      message: 'Exam attempt started'
    });
  } catch (error) {
    console.error('Start attempt error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET ATTEMPT
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [attempts] = await pool.execute(
      'SELECT * FROM exam_attempts WHERE id = ?',
      [id]
    );

    if (attempts.length === 0) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const attempt = attempts[0];
    attempt.answers = safeJsonParse(attempt.answers, []);

    res.json({
      success: true,
      data: attempt
    });
  } catch (error) {
    console.error('Get attempt error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// UPDATE ATTEMPT (save answers)
// ============================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { answers, tabSwitches } = req.body;

    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers must be an array' });
    }

    const updateParts = ['answers = ?'];
    const values = [JSON.stringify(answers)];

    if (tabSwitches !== undefined) {
      updateParts.push('tab_switches = ?');
      values.push(tabSwitches);
    }

    values.push(id);

    const query = `UPDATE exam_attempts SET ${updateParts.join(', ')} WHERE id = ?`;
    await pool.execute(query, values);

    res.json({
      success: true,
      message: 'Answers saved'
    });
  } catch (error) {
    console.error('Update attempt error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// SUBMIT EXAM ATTEMPT (Transactional & Idempotent for high concurrency)
// ============================================================
router.post('/:id/submit', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { answers, tabSwitches } = req.body;

    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers must be an array' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Check if already submitted and result exists (idempotency guard)
    const [existingResults] = await connection.execute(
      'SELECT * FROM exam_results WHERE attempt_id = ?',
      [id]
    );

    if (existingResults.length > 0) {
      await connection.commit();
      const r = existingResults[0];
      return res.json({
        success: true,
        data: {
          attemptId: id,
          totalQuestions: r.total_questions,
          correctAnswers: r.correct_answers,
          wrongAnswers: r.wrong_answers,
          unanswered: r.unanswered,
          totalMarks: Number(r.total_marks),
          obtainedMarks: Number(r.obtained_marks),
          percentage: Number(r.percentage)
        },
        message: 'Exam already submitted'
      });
    }

    // Lock attempt row for atomic submission
    const [attempts] = await connection.execute(
      'SELECT * FROM exam_attempts WHERE id = ? FOR UPDATE',
      [id]
    );

    if (attempts.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const attempt = attempts[0];

    // Update attempt status
    const updateParts = ['is_submitted = 1', 'submitted_at = NOW()', 'answers = ?'];
    const values = [JSON.stringify(answers)];
    
    if (tabSwitches !== undefined) {
      updateParts.push('tab_switches = ?');
      values.push(tabSwitches);
    }
    
    values.push(id);

    const query = `UPDATE exam_attempts SET ${updateParts.join(', ')} WHERE id = ?`;
    await connection.execute(query, values);

    // Get exam settings
    const [exams] = await connection.execute(
      'SELECT marks_per_question, negative_marks FROM exams WHERE id = ?',
      [attempt.exam_id]
    );

    const examSettings = exams[0] || {};
    const defaultMarks = Number(examSettings.marks_per_question ?? 1) || 1;
    const defaultNegativeMarks = Number(examSettings.negative_marks ?? 0) || 0;

    const canUseQuestionNegativeMarks = await supportsQuestionNegativeMarks();
    const questionQuery = canUseQuestionNegativeMarks
      ? 'SELECT id, correct_answer, marks, negative_marks FROM questions WHERE exam_id = ?'
      : 'SELECT id, correct_answer, marks FROM questions WHERE exam_id = ?';

    const [questions] = await connection.execute(
      questionQuery,
      [attempt.exam_id]
    );

    let correct = 0, wrong = 0, unanswered = 0;
    let totalMarks = 0;
    let obtainedMarks = 0;

    questions.forEach(question => {
      const questionMarks = Number(question.marks ?? defaultMarks) || defaultMarks;
      const questionNegativeMarks = question.negative_marks === null || question.negative_marks === undefined
        ? defaultNegativeMarks
        : Number(question.negative_marks) || 0;

      totalMarks += questionMarks;

      const answer = answers.find(a => a.questionId === question.id);
      if (!answer || answer.selectedAnswer === null || answer.selectedAnswer === undefined) {
        unanswered++;
      } else if (Number(answer.selectedAnswer) === Number(question.correct_answer)) {
        correct++;
        obtainedMarks += questionMarks;
      } else {
        wrong++;
        obtainedMarks -= questionNegativeMarks;
      }
    });

    obtainedMarks = Math.max(0, obtainedMarks);
    const percentage = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0;

    // Save result atomically
    const resultId = generateUUID();
    await connection.execute(
      `INSERT INTO exam_results (
        id, attempt_id, candidate_id, exam_id, total_questions,
        correct_answers, wrong_answers, unanswered, total_marks,
        obtained_marks, percentage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total_questions = VALUES(total_questions),
        correct_answers = VALUES(correct_answers),
        wrong_answers = VALUES(wrong_answers),
        unanswered = VALUES(unanswered),
        total_marks = VALUES(total_marks),
        obtained_marks = VALUES(obtained_marks),
        percentage = VALUES(percentage)`,
      [
        resultId, id, attempt.candidate_id, attempt.exam_id,
        questions.length, correct, wrong, unanswered,
        totalMarks, obtainedMarks, percentage
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      data: {
        attemptId: id,
        totalQuestions: questions.length,
        correctAnswers: correct,
        wrongAnswers: wrong,
        unanswered,
        totalMarks,
        obtainedMarks,
        percentage
      },
      message: 'Exam submitted and result calculated'
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }
    console.error('Submit attempt error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ============================================================
// GET ATTEMPTS FOR EXAM
// ============================================================
router.get('/exam/:examId', async (req, res) => {
  try {
    const { examId } = req.params;

    const [attempts] = await pool.execute(
      `SELECT ea.*, c.name, c.usn, c.email
       FROM exam_attempts ea
       JOIN candidates c ON ea.candidate_id = c.id
       WHERE ea.exam_id = ?
       ORDER BY ea.started_at DESC`,
      [examId]
    );

    res.json({
      success: true,
      data: attempts
    });
  } catch (error) {
    console.error('Get attempts error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

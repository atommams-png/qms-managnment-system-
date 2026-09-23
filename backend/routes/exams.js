// ============================================================
// EXAM ROUTES
// ============================================================

import express from 'express';
import pool from '../db.js';
import { generateUUID, generateCode } from '../utils.js';

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

// Helper function to safely parse JSON
const safeJsonParse = (jsonString, defaultValue = null) => {
  if (!jsonString) return defaultValue;
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('Failed to parse JSON:', jsonString, error.message);
    return defaultValue;
  }
};

const parseOptions = (rawOptions) => {
  if (Array.isArray(rawOptions)) return rawOptions;
  if (typeof rawOptions !== 'string') return [];

  const parsed = safeJsonParse(rawOptions, null);
  if (Array.isArray(parsed)) return parsed;

  // Backward compatibility for legacy rows saved as comma-separated text
  return rawOptions
    .split(',')
    .map(opt => opt.trim())
    .filter(Boolean);
};

const toMySqlDateTime = (value) => {
  if (!value) return null;

  const str = String(value).trim();
  // Match YYYY-MM-DD with optional time part
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const year = match[1];
    const month = match[2];
    const day = match[3];
    const hour = match[4] || '00';
    const minute = match[5] || '00';
    const second = match[6] || '00';
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  // Fallback for Date instances or unrecognized formats
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
};

// ============================================================
// IN-MEMORY EXAM CACHE (Reduces DB query load during exam start)
// ============================================================
const examCache = new Map();

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const clearExamCache = (examIdOrCode) => {
  if (!examIdOrCode) {
    examCache.clear();
  } else {
    for (const [key, val] of examCache.entries()) {
      if (key.includes(examIdOrCode) || (val.data && (val.data.id === examIdOrCode || val.data.code === examIdOrCode))) {
        examCache.delete(key);
      }
    }
  }
};

// ============================================================
// GET ALL EXAMS
// ============================================================
router.get('/', async (req, res) => {
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

    res.json({
      success: true,
      data: exams
    });
  } catch (error) {
    console.error('Get exams error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET EXAM BY CODE (for candidates)
// ============================================================
router.get('/code/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const cacheKey = `code_${code}`;
    const cached = examCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return res.json({
        success: true,
        data: cached.data
      });
    }

    const [exams] = await pool.execute(
      'SELECT * FROM exams WHERE code = ? AND is_active = 1',
      [code]
    );

    if (exams.length === 0) {
      return res.status(404).json({ error: 'Exam not found or not active' });
    }

    // Get questions for this exam
    const [questions] = await pool.execute(
      'SELECT * FROM questions WHERE exam_id = ? ORDER BY display_order',
      [exams[0].id]
    );

    // Parse JSON fields
    const parsedQuestions = questions.map(q => ({
      ...q,
      options: parseOptions(q.options),
      optionImages: safeJsonParse(q.option_images)
    }));

    const exam = exams[0];
    exam.questions = parsedQuestions;

    examCache.set(cacheKey, { timestamp: Date.now(), data: exam });
    examCache.set(`id_${exam.id}`, { timestamp: Date.now(), data: exam });

    res.json({
      success: true,
      data: exam
    });
  } catch (error) {
    console.error('Get exam by code error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET EXAM BY ID
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `id_${id}`;
    const cached = examCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return res.json({
        success: true,
        data: cached.data
      });
    }

    const [exams] = await pool.execute(
      'SELECT * FROM exams WHERE id = ?',
      [id]
    );

    if (exams.length === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Get questions for this exam
    const [questions] = await pool.execute(
      'SELECT * FROM questions WHERE exam_id = ? ORDER BY display_order',
      [id]
    );

    // Parse JSON fields in questions
    const parsedQuestions = questions.map(q => ({
      ...q,
      options: parseOptions(q.options),
      optionImages: safeJsonParse(q.option_images)
    }));

    const exam = exams[0];
    exam.questions = parsedQuestions;

    examCache.set(cacheKey, { timestamp: Date.now(), data: exam });
    if (exam.code) {
      examCache.set(`code_${exam.code}`, { timestamp: Date.now(), data: exam });
    }

    res.json({
      success: true,
      data: exam
    });
  } catch (error) {
    console.error('Get exam error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// CREATE EXAM
// ============================================================
router.post('/', async (req, res) => {
  try {
    const { name, settings, startDateTime, endDateTime } = req.body;
    const normalizedStartDateTime = toMySqlDateTime(startDateTime);
    const normalizedEndDateTime = toMySqlDateTime(endDateTime);

    if (!name || !settings) {
      return res.status(400).json({ error: 'Name and settings required' });
    }

    const id = generateUUID();
    const code = generateCode();

    await pool.execute(
      `INSERT INTO exams (
        id, name, code, duration, marks_per_question, negative_marks,
        show_result, random_order, fullscreen_mode, tab_switch_detection,
        max_tab_switches, navigation_panel, question_timer,
        start_date_time, end_date_time, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id, name, code,
        settings.duration || 60,
        settings.marksPerQuestion || 1,
        settings.negativeMarks || 0,
        settings.showResult ? 1 : 0,
        settings.randomOrder ? 1 : 0,
        settings.fullscreenMode ? 1 : 0,
        settings.tabSwitchDetection ? 1 : 0,
        settings.maxTabSwitches || 0,
        settings.navigationPanel ? 1 : 0,
        settings.questionTimer || 0,
        normalizedStartDateTime,
        normalizedEndDateTime
      ]
    );

    res.json({
      success: true,
      data: {
        id,
        name,
        code,
        ...settings,
        startDateTime: normalizedStartDateTime,
        endDateTime: normalizedEndDateTime
      },
      message: 'Exam created successfully'
    });
  } catch (error) {
    console.error('Create exam error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// UPDATE EXAM
// ============================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, settings } = req.body;
    const normalizedStartDateTime = toMySqlDateTime(req.body.startDateTime);
    const normalizedEndDateTime = toMySqlDateTime(req.body.endDateTime);

    if (!name || !settings) {
      return res.status(400).json({ error: 'Name and settings required' });
    }

    await pool.execute(
      `UPDATE exams SET
        name = ?,
        duration = ?,
        marks_per_question = ?,
        negative_marks = ?,
        show_result = ?,
        random_order = ?,
        fullscreen_mode = ?,
        tab_switch_detection = ?,
        max_tab_switches = ?,
        navigation_panel = ?,
        question_timer = ?,
        start_date_time = ?,
        end_date_time = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        name,
        settings.duration || 60,
        settings.marksPerQuestion || 1,
        settings.negativeMarks || 0,
        settings.showResult ? 1 : 0,
        settings.randomOrder ? 1 : 0,
        settings.fullscreenMode ? 1 : 0,
        settings.tabSwitchDetection ? 1 : 0,
        settings.maxTabSwitches || 0,
        settings.navigationPanel ? 1 : 0,
        settings.questionTimer || 0,
        normalizedStartDateTime,
        normalizedEndDateTime,
        id
      ]
    );

    clearExamCache(id);

    res.json({
      success: true,
      message: 'Exam updated successfully'
    });
  } catch (error) {
    console.error('Update exam error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// TOGGLE EXAM ACTIVE STATUS
// ============================================================
router.patch('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute(
      'UPDATE exams SET is_active = !is_active WHERE id = ?',
      [id]
    );

    clearExamCache(id);

    const [updated] = await pool.execute(
      'SELECT is_active FROM exams WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      data: { isActive: updated[0].is_active },
      message: 'Exam status toggled'
    });
  } catch (error) {
    console.error('Toggle exam error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// DELETE EXAM
// ============================================================
router.delete('/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Manual cascade for compatibility with existing databases that may lack FK cascade.
    await connection.execute('DELETE FROM exam_results WHERE exam_id = ?', [id]);
    await connection.execute('DELETE FROM exam_attempts WHERE exam_id = ?', [id]);
    await connection.execute('DELETE FROM candidates WHERE exam_id = ?', [id]);
    await connection.execute('DELETE FROM questions WHERE exam_id = ?', [id]);
    const [result] = await connection.execute('DELETE FROM exams WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Exam not found' });
    }

    await connection.commit();
    clearExamCache(id);

    res.json({
      success: true,
      message: 'Exam deleted successfully'
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }
    console.error('Delete exam error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// ============================================================
// ADD QUESTION TO EXAM
// ============================================================
router.post('/:examId/questions', async (req, res) => {
  try {
    const { examId } = req.params;
    const { type, text, imageUrl, options, correctAnswer, optionImages, marks, negativeMarks, section, passage, passageGroupId } = req.body;

    if (!type || !text || !options || correctAnswer === undefined) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const id = generateUUID();

    // Get max display order
    const [orderResult] = await pool.execute(
      'SELECT MAX(display_order) as max_order FROM questions WHERE exam_id = ?',
      [examId]
    );
    const displayOrder = (orderResult[0].max_order || 0) + 1;

    const canStoreQuestionNegativeMarks = await supportsQuestionNegativeMarks();

    const insertQuery = canStoreQuestionNegativeMarks
      ? `INSERT INTO questions (
          id, exam_id, type, text, image_url, options, correct_answer,
          option_images, display_order, marks, negative_marks, section, passage, passage_group_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      : `INSERT INTO questions (
          id, exam_id, type, text, image_url, options, correct_answer,
          option_images, display_order, marks, section, passage, passage_group_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const insertValues = canStoreQuestionNegativeMarks
      ? [
          id, examId, type, text, imageUrl || null,
          JSON.stringify(options), correctAnswer,
          optionImages ? JSON.stringify(optionImages) : null,
          displayOrder,
          marks || 1,
          negativeMarks ?? null,
          section || null,
          passage || null,
          passageGroupId || null
        ]
      : [
          id, examId, type, text, imageUrl || null,
          JSON.stringify(options), correctAnswer,
          optionImages ? JSON.stringify(optionImages) : null,
          displayOrder,
          marks || 1,
          section || null,
          passage || null,
          passageGroupId || null
        ];

    await pool.execute(insertQuery, insertValues);
    clearExamCache(examId);

    res.json({
      success: true,
      data: {
        id, examId, type, text, imageUrl, options, correctAnswer, optionImages, marks, negativeMarks, section, passage, passageGroupId
      },
      message: 'Question added successfully'
    });
  } catch (error) {
    console.error('Add question error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// UPDATE QUESTION
// ============================================================
router.put('/:examId/questions/:questionId', async (req, res) => {
  try {
    const { examId, questionId } = req.params;
    const { type, text, imageUrl, options, correctAnswer, optionImages, marks, negativeMarks, section, passage, passageGroupId } = req.body;

    if (!type || !text || !options || correctAnswer === undefined) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const canStoreQuestionNegativeMarks = await supportsQuestionNegativeMarks();

    const updateQuery = canStoreQuestionNegativeMarks
      ? `UPDATE questions SET
          type = ?, text = ?, image_url = ?, options = ?,
          correct_answer = ?, option_images = ?, marks = ?, negative_marks = ?, section = ?,
          passage = ?, passage_group_id = ?, updated_at = NOW()
        WHERE id = ? AND exam_id = ?`
      : `UPDATE questions SET
          type = ?, text = ?, image_url = ?, options = ?,
          correct_answer = ?, option_images = ?, marks = ?, section = ?,
          passage = ?, passage_group_id = ?, updated_at = NOW()
        WHERE id = ? AND exam_id = ?`;

    const updateValues = canStoreQuestionNegativeMarks
      ? [
          type, text, imageUrl || null, JSON.stringify(options),
          correctAnswer, optionImages ? JSON.stringify(optionImages) : null,
          marks || 1, negativeMarks ?? null, section || null, passage || null, passageGroupId || null,
          questionId, examId
        ]
      : [
          type, text, imageUrl || null, JSON.stringify(options),
          correctAnswer, optionImages ? JSON.stringify(optionImages) : null,
          marks || 1, section || null, passage || null, passageGroupId || null,
          questionId, examId
        ];

    await pool.execute(updateQuery, updateValues);
    clearExamCache(examId);

    res.json({
      success: true,
      message: 'Question updated successfully'
    });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// DELETE QUESTION
// ============================================================
router.delete('/:examId/questions/:questionId', async (req, res) => {
  try {
    const { examId, questionId } = req.params;

    await pool.execute(
      'DELETE FROM questions WHERE id = ? AND exam_id = ?',
      [questionId, examId]
    );

    clearExamCache(examId);

    res.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

// ============================================================
// CANDIDATE ROUTES
// ============================================================

import express from 'express';
import pool from '../db.js';
import { generateUUID } from '../utils.js';

const router = express.Router();

let sectionColumnEnsured = false;

async function ensureCandidateSectionColumn() {
  if (sectionColumnEnsured) return;

  const [rows] = await pool.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'candidates'
       AND COLUMN_NAME = 'section'
     LIMIT 1`
  );

  if (rows.length === 0) {
    await pool.execute(`
      ALTER TABLE candidates
      ADD COLUMN section VARCHAR(50)
      COMMENT 'Section/Division (e.g., A, B)'
      AFTER department
    `);
  }

  sectionColumnEnsured = true;
}

// ============================================================
// REGISTER CANDIDATE
// ============================================================
router.post('/', async (req, res) => {
  try {
    const { examId, name, email, phone, college, usn, department, section } = req.body;

    if (!examId || !name || !email || !usn || !department) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Check for duplicates
    const [existing] = await pool.execute(
      'SELECT id FROM candidates WHERE exam_id = ? AND usn = ? AND department = ?',
      [examId, usn, department]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Duplicate: Student already registered for this exam' });
    }

    const id = generateUUID();

    const insertWithSection = async () => pool.execute(
      `INSERT INTO candidates (
        id, exam_id, name, email, phone, college, usn, department, section
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, examId, name, email, phone || null, college || null, usn, department, section || null]
    );

    try {
      await insertWithSection();
    } catch (error) {
      const isMissingSectionColumn =
        error?.code === 'ER_BAD_FIELD_ERROR' &&
        String(error?.sqlMessage || '').includes("Unknown column 'section'");

      if (!isMissingSectionColumn) throw error;

      await ensureCandidateSectionColumn();
      await insertWithSection();
    }

    res.json({
      success: true,
      data: { id, examId, name, email, phone, college, usn, department, section },
      message: 'Candidate registered successfully'
    });
  } catch (error) {
    console.error('Register candidate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET CANDIDATES FOR EXAM
// ============================================================
router.get('/exam/:examId', async (req, res) => {
  try {
    const { examId } = req.params;

    const [candidates] = await pool.execute(
      'SELECT * FROM candidates WHERE exam_id = ? ORDER BY registered_at DESC',
      [examId]
    );

    res.json({
      success: true,
      data: candidates
    });
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET SINGLE CANDIDATE
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [candidates] = await pool.execute(
      'SELECT * FROM candidates WHERE id = ?',
      [id]
    );

    if (candidates.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    res.json({
      success: true,
      data: candidates[0]
    });
  } catch (error) {
    console.error('Get candidate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// DELETE CANDIDATE (admin)
// ============================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute('DELETE FROM candidates WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Candidate deleted successfully'
    });
  } catch (error) {
    console.error('Delete candidate error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

// ============================================================
// CANDIDATE ROUTES
// ============================================================

import express from 'express';
import pool from '../db.js';
import { generateUUID } from '../utils.js';

const router = express.Router();

let columnsEnsured = false;

async function ensureCandidateColumns() {
  if (columnsEnsured) return;

  try {
    const [rows] = await pool.execute(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'candidates'`
    );

    const existingColumns = rows.map(r => r.COLUMN_NAME);

    if (!existingColumns.includes('section')) {
      await pool.execute(`
        ALTER TABLE candidates
        ADD COLUMN section VARCHAR(50)
        COMMENT 'Section/Division (e.g., A, B)'
        AFTER department
      `);
    }

    if (!existingColumns.includes('device_type')) {
      await pool.execute(`
        ALTER TABLE candidates
        ADD COLUMN device_type VARCHAR(50) DEFAULT NULL COMMENT 'mobile, desktop, tablet' AFTER section,
        ADD COLUMN device_name VARCHAR(100) DEFAULT NULL COMMENT 'Detected Device Label' AFTER device_type,
        ADD COLUMN device_os VARCHAR(50) DEFAULT NULL COMMENT 'Android, iOS, Windows, macOS, Linux' AFTER device_name,
        ADD COLUMN is_desktop_mode BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Whether student enabled desktop version' AFTER device_os,
        ADD COLUMN device_info JSON DEFAULT NULL COMMENT 'Hardware and browser telemetry' AFTER is_desktop_mode
      `);
    }

    columnsEnsured = true;
  } catch (err) {
    console.error('Error ensuring candidate columns:', err);
  }
}

// ============================================================
// REGISTER CANDIDATE
// ============================================================
router.post('/', async (req, res) => {
  try {
    await ensureCandidateColumns();

    const {
      examId,
      name,
      email,
      phone,
      college,
      usn,
      department,
      section,
      deviceType,
      deviceName,
      deviceOs,
      isDesktopMode,
      deviceInfo
    } = req.body;

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
    const deviceInfoJson = deviceInfo ? (typeof deviceInfo === 'string' ? deviceInfo : JSON.stringify(deviceInfo)) : null;

    await pool.execute(
      `INSERT INTO candidates (
        id, exam_id, name, email, phone, college, usn, department, section,
        device_type, device_name, device_os, is_desktop_mode, device_info
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        examId,
        name,
        email,
        phone || null,
        college || null,
        usn,
        department,
        section || null,
        deviceType || null,
        deviceName || null,
        deviceOs || null,
        isDesktopMode ? 1 : 0,
        deviceInfoJson
      ]
    );

    res.json({
      success: true,
      data: {
        id,
        examId,
        name,
        email,
        phone,
        college,
        usn,
        department,
        section,
        deviceType,
        deviceName,
        deviceOs,
        isDesktopMode: Boolean(isDesktopMode),
        deviceInfo
      },
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
    await ensureCandidateColumns();
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
    await ensureCandidateColumns();
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

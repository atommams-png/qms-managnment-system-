// ============================================================
// RESULT ROUTES
// ============================================================

import express from 'express';
import pool from '../db.js';

const router = express.Router();

// ============================================================
// GET RESULT FOR ATTEMPT
// ============================================================
router.get('/attempt/:attemptId', async (req, res) => {
  try {
    const { attemptId } = req.params;

    const [results] = await pool.execute(
      'SELECT * FROM exam_results WHERE attempt_id = ?',
      [attemptId]
    );

    if (results.length === 0) {
      return res.status(404).json({ error: 'Result not found' });
    }

    res.json({
      success: true,
      data: results[0]
    });
  } catch (error) {
    console.error('Get result error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET RESULTS FOR EXAM
// ============================================================
router.get('/exam/:examId', async (req, res) => {
  try {
    const { examId } = req.params;

    const [results] = await pool.execute(
      `SELECT r.*, c.name, c.usn, c.email, c.department
       FROM exam_results r
       JOIN candidates c ON r.candidate_id = c.id
       WHERE r.exam_id = ?
       ORDER BY r.percentage DESC`,
      [examId]
    );

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Get exam results error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET RESULTS FOR CANDIDATE
// ============================================================
router.get('/candidate/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;

    const [results] = await pool.execute(
      `SELECT r.*, e.name as exam_name, e.code
       FROM exam_results r
       JOIN exams e ON r.exam_id = e.id
       WHERE r.candidate_id = ?
       ORDER BY r.calculated_at DESC`,
      [candidateId]
    );

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Get candidate results error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET EXAM STATISTICS
// ============================================================
router.get('/stats/exam/:examId', async (req, res) => {
  try {
    const { examId } = req.params;

    const [stats] = await pool.execute(
      `SELECT
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
      WHERE e.id = ?
      GROUP BY e.id, e.name, e.code`,
      [examId]
    );

    if (stats.length === 0) {
      return res.status(404).json({ error: 'No results found for this exam' });
    }

    res.json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// EXPORT RESULTS AS CSV
// ============================================================
router.get('/export/:examId', async (req, res) => {
  try {
    const { examId } = req.params;

    const [results] = await pool.execute(
      `SELECT c.name, c.email, c.usn, c.department, c.college,
              r.total_marks, r.obtained_marks, r.percentage,
              r.correct_answers, r.wrong_answers, r.unanswered
       FROM exam_results r
       JOIN candidates c ON r.candidate_id = c.id
       WHERE r.exam_id = ?
       ORDER BY r.percentage DESC`,
      [examId]
    );

    // Create CSV
    let csv = 'Name,Email,USN,Department,College,Total Marks,Obtained Marks,Percentage,Correct,Wrong,Unanswered\n';
    results.forEach(r => {
      csv += `"${r.name}","${r.email}","${r.usn}","${r.department}","${r.college}",${r.total_marks},${r.obtained_marks},${r.percentage},${r.correct_answers},${r.wrong_answers},${r.unanswered}\n`;
    });

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="exam-results-${examId}.csv"`
    });
    res.send(csv);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

// ============================================================
// ADMIN ROUTES (Authentication)
// ============================================================

import express from 'express';
import pool from '../db.js';
import { generateUUID } from '../utils.js';

const router = express.Router();

// ============================================================
// LOGIN
// ============================================================
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const [rows] = await pool.execute(
      'SELECT id, username FROM admins WHERE username = ? AND password = ?',
      [username, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = rows[0];
    res.json({
      success: true,
      data: {
        id: admin.id,
        username: admin.username
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET ADMIN PROFILE (if needed)
// ============================================================
router.get('/profile/:adminId', async (req, res) => {
  try {
    const { adminId } = req.params;

    const [rows] = await pool.execute(
      'SELECT id, username, created_at FROM admins WHERE id = ?',
      [adminId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

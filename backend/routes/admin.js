const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const adminMiddleware = require('../middleware/admin');

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { login, password } = req.body;

  const validLogin = process.env.ADMIN_LOGIN || 'admin';
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!validPassword) {
    return res.status(500).json({ error: 'Admin password not configured' });
  }

  if (login === validLogin && password === validPassword) {
    return res.json({ key: process.env.ADMIN_KEY });
  }

  res.status(401).json({ error: 'Неверный логин или пароль' });
});

// GET /api/admin/users
router.get('/users', adminMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, email, subscription_plan, subscription_expires, created_at
      FROM users ORDER BY id DESC
    `);
    res.json({ users: rows });
  } catch (err) {
  console.error('ADMIN USERS ERROR:', err);
  res.status(500).json({ error: err.message });
}
});

// GET /api/admin/subscription-history/:userId
router.get('/subscription-history/:userId', adminMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM subscription_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',
      [req.params.userId]
    );
    res.json({ history: rows });
  } catch (err) {
  console.error('ADMIN HISTORY ERROR:', err);
  res.status(500).json({ error: err.message });
}
});

// POST /api/admin/subscription/grant/:id
router.post('/subscription/grant/:id', adminMiddleware, async (req, res) => {
  const { custom_days } = req.body;
  const days = parseInt(custom_days) || 30;

  try {
    await pool.query(`
      UPDATE users
      SET subscription_expires = NOW() + ($1 || ' days')::interval,
          subscription_plan = COALESCE(subscription_plan, 'custom')
      WHERE id = $2
    `, [days, req.params.id]);

    await pool.query(`
      INSERT INTO subscription_history (user_id, duration_days, action, notes)
      VALUES ($1, $2, 'granted', 'By admin')
    `, [req.params.id, days]);

    res.json({ success: true });
  } catch (err) {
  console.error('ADMIN GRANT ERROR:', err);
  res.status(500).json({ error: err.message });
}
});

// POST /api/admin/subscription/revoke/:id
router.post('/subscription/revoke/:id', adminMiddleware, async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET subscription_plan=NULL, subscription_expires=NULL WHERE id=$1',
      [req.params.id]
    );

    await pool.query(`
      INSERT INTO subscription_history (user_id, action, notes)
      VALUES ($1, 'revoked', 'By admin')
    `, [req.params.id]);

    res.json({ success: true });
  } catch (err) {
  console.error('ADMIN REVOKE ERROR:', err);
  res.status(500).json({ error: err.message });
}
});

// DELETE /api/admin/delete/:id
router.delete('/delete/:id', adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
  console.error('ADMIN DELETE ERROR:', err);
  res.status(500).json({ error: err.message });
}
});

module.exports = router;

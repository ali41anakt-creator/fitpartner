const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const auth = require('../middleware/auth');

const SEARCH_LIMIT_PER_DAY = 10;

// GET /api/subscription/plans
router.get('/plans', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM subscription_plans WHERE is_active=TRUE ORDER BY duration_days ASC'
    );
    res.json({ plans: rows });
  } catch (err) { next(err); }
});

// GET /api/subscription/status
router.get('/status', auth, (req, res) => {
  const u = req.user;
  const now = new Date();
  const expires = u.subscription_expires ? new Date(u.subscription_expires) : null;
  const active = !!(expires && expires > now);

  res.json({
    active,
    plan: u.subscription_plan || null,
    expires_at: u.subscription_expires,
    days_left: active ? Math.ceil((expires - now) / 86400000) : 0,
    searches_today: u.searches_today || 0,
    searches_remaining: SEARCH_LIMIT_PER_DAY - (u.searches_today || 0)
  });
});

// POST /api/subscription/activate — пользователь инициирует оплату через Kaspi
router.post('/activate', auth, async (req, res, next) => {
  try {
    const { kaspi_phone, plan_id } = req.body;
    if (!kaspi_phone || !plan_id) {
      return res.status(400).json({ error: 'Укажите plan_id и kaspi_phone' });
    }

    const { rows: plans } = await pool.query(
      'SELECT * FROM subscription_plans WHERE id=$1 AND is_active=TRUE',
      [plan_id]
    );
    if (!plans[0]) return res.status(404).json({ error: 'Тариф не найден' });

    const plan = plans[0];

    await pool.query(`
      INSERT INTO subscription_history (user_id, plan, duration_days, action, kaspi_phone)
      VALUES ($1, $2, $3, 'requested', $4)
    `, [req.user.id, plan.plan_name, plan.duration_days, kaspi_phone]);

    res.json({
      message: 'Заявка создана. Администратор активирует подписку в течение нескольких минут.',
      kaspi_number: process.env.KASPI_PHONE || '+7 747 210 52 70',
      amount: plan.price_kzt,
      plan_name: plan.plan_name,
      duration_days: plan.duration_days
    });
  } catch (err) { next(err); }
});

module.exports = router;

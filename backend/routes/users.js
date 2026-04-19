const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const auth = require('../middleware/auth');

const SEARCH_LIMIT_PER_DAY = 10;
const FREE_USER_LIMIT = 5;

// Сбрасываем счётчик поисков если прошли сутки
async function resetSearchLimitIfNeeded(userId) {
  const { rows } = await pool.query(
    'SELECT last_search_reset FROM users WHERE id=$1',
    [userId]
  );
  if (!rows[0]) return;

  const lastReset = new Date(rows[0].last_search_reset);
  const daysPassed = Math.floor((Date.now() - lastReset) / (1000 * 60 * 60 * 24));

  if (daysPassed >= 1) {
    await pool.query(
      'UPDATE users SET searches_today=0, last_search_reset=NOW() WHERE id=$1',
      [userId]
    );
  }
}

// GET /api/users/count — публичный, для счётчика на главной
router.get('/count', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) AS total FROM users');
    res.json({ total: parseInt(rows[0].total) });
  } catch (err) { next(err); }
});

// GET /api/users/new — последние зарегистрированные
router.get('/new', auth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, age, gender, fitness_level, goals, district, avatar, created_at
      FROM users WHERE id != $1 ORDER BY created_at DESC LIMIT 6
    `, [req.user.id]);
    res.json({ users: rows });
  } catch (err) { next(err); }
});

// GET /api/users — поиск с лимитами для бесплатных
router.get('/', auth, async (req, res, next) => {
  try {
    await resetSearchLimitIfNeeded(req.user.id);

    const isSubscribed = req.user.subscription_expires && new Date(req.user.subscription_expires) > new Date();
    let remaining = SEARCH_LIMIT_PER_DAY;

    if (!isSubscribed) {
      const { rows } = await pool.query(
        'SELECT searches_today FROM users WHERE id=$1',
        [req.user.id]
      );
      remaining = SEARCH_LIMIT_PER_DAY - (rows[0]?.searches_today || 0);

      if (remaining <= 0) {
        return res.status(429).json({
          error: 'Лимит поисков исчерпан. Попробуйте завтра или оформите подписку.',
          searches_remaining: 0,
          search_limit: SEARCH_LIMIT_PER_DAY
        });
      }

      await pool.query(
        'UPDATE users SET searches_today = searches_today + 1 WHERE id=$1',
        [req.user.id]
      );
    }

    const { gender, fitness_level, district } = req.query;
    let q = `
      SELECT id, uuid, name, age, gender, fitness_level, goals, schedule,
             bio, district, avatar, last_seen, subscription_expires
      FROM users WHERE id != $1
    `;
    const params = [req.user.id];
    let i = 2;

    if (gender) { q += ` AND gender = $${i++}`; params.push(gender); }
    if (fitness_level) { q += ` AND fitness_level = $${i++}`; params.push(fitness_level); }
    if (district) { q += ` AND district ILIKE $${i++}`; params.push(`%${district}%`); }

    q += ' ORDER BY last_seen DESC LIMIT 100';

    const { rows: allUsers } = await pool.query(q, params);

    const { rows: likes } = await pool.query(
      'SELECT to_user FROM likes WHERE from_user=$1',
      [req.user.id]
    );
    const likedIds = new Set(likes.map(l => l.to_user));

    const mapped = allUsers.map(u => ({
      ...u,
      is_subscribed: !!(u.subscription_expires && new Date(u.subscription_expires) > new Date()),
      liked: likedIds.has(u.id)
    }));

    const total = mapped.length;
    const limited = !isSubscribed && total > FREE_USER_LIMIT;
    const users = isSubscribed ? mapped : mapped.slice(0, FREE_USER_LIMIT);

    res.json({
      users,
      total,
      limited,
      free_limit: FREE_USER_LIMIT,
      hidden: limited ? total - FREE_USER_LIMIT : 0,
      searches_remaining: isSubscribed ? null : remaining - 1,
      search_limit: SEARCH_LIMIT_PER_DAY
    });
  } catch (err) { next(err); }
});

// GET /api/users/:id
router.get('/:id', auth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Неверный ID пользователя' });

    const { rows } = await pool.query(`
      SELECT id, uuid, name, age, gender, fitness_level, goals,
             schedule, bio, district, avatar, last_seen, subscription_expires
      FROM users WHERE id=$1
    `, [id]);

    if (!rows[0]) return res.status(404).json({ error: 'Пользователь не найден' });

    res.json({
      user: {
        ...rows[0],
        is_subscribed: !!(rows[0].subscription_expires && new Date(rows[0].subscription_expires) > new Date())
      }
    });
  } catch (err) { next(err); }
});

// POST /api/users/:id/like — только Premium
router.post('/:id/like', auth, async (req, res, next) => {
  try {
    const isSubscribed = req.user.subscription_expires && new Date(req.user.subscription_expires) > new Date();
    if (!isSubscribed) {
      return res.status(403).json({ error: 'Лайки доступны только с Premium подпиской' });
    }

    const targetId = parseInt(req.params.id);
    if (isNaN(targetId)) return res.status(400).json({ error: 'Неверный ID пользователя' });
    if (targetId === req.user.id) return res.status(400).json({ error: 'Нельзя лайкнуть себя' });

    const { rows } = await pool.query(
      'SELECT id FROM likes WHERE from_user=$1 AND to_user=$2',
      [req.user.id, targetId]
    );

    if (rows[0]) {
      await pool.query('DELETE FROM likes WHERE from_user=$1 AND to_user=$2', [req.user.id, targetId]);
      return res.json({ liked: false });
    }

    await pool.query('INSERT INTO likes (from_user, to_user) VALUES ($1,$2)', [req.user.id, targetId]);
    res.json({ liked: true });
  } catch (err) { next(err); }
});

module.exports = router;

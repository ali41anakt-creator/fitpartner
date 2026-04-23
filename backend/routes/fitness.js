const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const auth = require('../middleware/auth');

function getKzDate() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short'
  });
}

function normalizeGoal(user) {
  const text = `${user.goals || ''} ${user.fitness_level || ''}`.toLowerCase();

  if (
    text.includes('похуд') ||
    text.includes('сушка') ||
    text.includes('lose') ||
    text.includes('weight')
  ) return 'weight_loss';

  if (
    text.includes('масса') ||
    text.includes('набор') ||
    text.includes('muscle') ||
    text.includes('gain')
  ) return 'muscle_gain';

  return 'balanced';
}

function buildTemplate(user, index = 0) {
  const goal = normalizeGoal(user);
  const level = user.fitness_level || 'beginner';

  const duration =
    level === 'beginner' ? 20 :
    level === 'advanced' ? 45 : 30;

  const templates = {
    weight_loss: [
      { title: 'Кардио + пресс', description: 'Быстрая жиросжигающая сессия и упражнения на корпус.' },
      { title: 'Круговая тренировка', description: 'Полное тело, короткие паузы, высокий пульс.' },
      { title: 'Шаги + растяжка', description: 'Лёгкая активность для восстановления и расхода калорий.' },
      { title: 'Интервальное кардио', description: 'Чередование темпа для ускорения прогресса.' },
      { title: 'Full body burn', description: 'Смешанная тренировка на всё тело.' },
      { title: 'Восстановление', description: 'Прогулка, мобильность, растяжка.' },
      { title: 'Свободный день', description: 'Лёгкая активность по самочувствию.' }
    ],
    muscle_gain: [
      { title: 'Грудь + трицепс', description: 'Базовая силовая тренировка на верх тела.' },
      { title: 'Спина + бицепс', description: 'Тяги, подтягивания, упражнения на спину.' },
      { title: 'Ноги', description: 'Приседания, выпады, ягодицы и квадрицепсы.' },
      { title: 'Плечи + корпус', description: 'Дельты, стабилизация и пресс.' },
      { title: 'Full body strength', description: 'Сильная общая силовая нагрузка.' },
      { title: 'Лёгкое кардио', description: 'Поддержка сердца и восстановление.' },
      { title: 'Отдых', description: 'Полный отдых или прогулка.' }
    ],
    balanced: [
      { title: 'Full body', description: 'Сбалансированная тренировка на всё тело.' },
      { title: 'Кардио + мобильность', description: 'Лёгкое кардио и разминка суставов.' },
      { title: 'Силовая база', description: 'Основные упражнения с нормальным темпом.' },
      { title: 'Корпус + пресс', description: 'Стабилизация, баланс и пресс.' },
      { title: 'Интервальная тренировка', description: 'Смешанный формат для общей формы.' },
      { title: 'Восстановление', description: 'Растяжка и прогулка.' },
      { title: 'Свободный день', description: 'Активность по желанию.' }
    ]
  };

  const item = templates[goal][index % 7];

  return {
    title: item.title,
    description: `${item.description} Рекомендуемое время: ${duration} мин.`,
    calories_target:
      goal === 'weight_loss' ? 1800 :
      goal === 'muscle_gain' ? 2400 : 2100,
    advice:
      goal === 'weight_loss' ? 'Сделай упор на кардио и воду.' :
      goal === 'muscle_gain' ? 'Добавь белок и силовую нагрузку.' :
      'Сохраняй баланс между тренировкой и восстановлением.'
  };
}

async function seedWeekPlan(client, user) {
  const today = getKzDate();

  for (let i = 0; i < 7; i++) {
    const planDate = addDays(today, i);
    const tpl = buildTemplate(user, i);

    await client.query(`
      INSERT INTO workout_plans (user_id, title, description, plan_date, status)
      VALUES ($1, $2, $3, $4, 'planned')
      ON CONFLICT (user_id, plan_date) DO NOTHING
    `, [user.id, tpl.title, tpl.description, planDate]);
  }
}

async function getStreakRow(client, userId) {
  const { rows } = await client.query(
    'SELECT * FROM user_streaks WHERE user_id=$1',
    [userId]
  );
  return rows[0] || {
    user_id: userId,
    current_streak: 0,
    best_streak: 0,
    last_active_date: null
  };
}

async function touchStreak(client, userId, today) {
  const { rows } = await client.query(
    'SELECT * FROM user_streaks WHERE user_id=$1 FOR UPDATE',
    [userId]
  );

  const existing = rows[0];
  if (!existing) {
    const { rows: created } = await client.query(`
      INSERT INTO user_streaks (user_id, current_streak, best_streak, last_active_date)
      VALUES ($1, 1, 1, $2)
      RETURNING *
    `, [userId, today]);
    return created[0];
  }

  const last = existing.last_active_date
    ? new Date(existing.last_active_date).toISOString().slice(0, 10)
    : null;

  if (last === today) return existing;

  const yesterday = addDays(today, -1);
  const current = last === yesterday ? (existing.current_streak || 0) + 1 : 1;
  const best = Math.max(existing.best_streak || 0, current);

  const { rows: updated } = await client.query(`
    UPDATE user_streaks
    SET current_streak=$1, best_streak=$2, last_active_date=$3
    WHERE user_id=$4
    RETURNING *
  `, [current, best, today, userId]);

  return updated[0];
}



// GET /api/fitness/today
router.get('/today', auth, async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      await seedWeekPlan(client, req.user);

      const today = getKzDate();
      const { rows } = await client.query(`
        SELECT id, title, description, plan_date, status
        FROM workout_plans
        WHERE user_id=$1 AND plan_date=$2
        LIMIT 1
      `, [req.user.id, today]);

      const streak = await getStreakRow(client, req.user.id);
      const suggestion = buildTemplate(req.user, 0);
      const plan = rows[0] || {
        title: suggestion.title,
        description: suggestion.description,
        plan_date: today,
        status: 'planned'
      };

      res.json({
        today: {
          date: today,
          plan,
          calories_target: suggestion.calories_target,
          advice: suggestion.advice
        },
        streak: {
          current_streak: streak.current_streak || 0,
          best_streak: streak.best_streak || 0,
          last_active_date: streak.last_active_date || null
        }
      });
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/fitness/week-plan
router.get('/week-plan', auth, async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      await seedWeekPlan(client, req.user);

      const today = getKzDate();
      const end = addDays(today, 6);

      const { rows } = await client.query(`
        SELECT id, title, description, plan_date, status
        FROM workout_plans
        WHERE user_id=$1 AND plan_date BETWEEN $2::date AND $3::date
        ORDER BY plan_date ASC
      `, [req.user.id, today, end]);

      res.json({ plans: rows });
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

async function getProgressData(userId) {
  try {
    const today = getKzDate();
    const start = addDays(today, -6);

    const { rows } = await pool.query(`
      SELECT
        (completed_at AT TIME ZONE 'Asia/Almaty')::date AS day,
        COUNT(*)::int AS workouts,
        COALESCE(SUM(calories_burned), 0)::int AS calories
      FROM workout_logs
      WHERE user_id=$1
        AND (completed_at AT TIME ZONE 'Asia/Almaty')::date
            BETWEEN $2::date AND $3::date
      GROUP BY (completed_at AT TIME ZONE 'Asia/Almaty')::date
      ORDER BY day ASC
    `, [userId, start, today]);
    console.log('ROWS:', rows);

    const map = new Map(
  rows.map(r => [
    new Date(r.day).toISOString().slice(0, 10),
    r
  ])
);

    const labels = [];
    const workouts = [];
    const calories = [];

    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const row = map.get(d);

      labels.push(dayLabel(d));
      workouts.push(row ? Number(row.workouts) : 0);
      calories.push(row ? Number(row.calories) : 0);
    }
    console.log('ROWS:', rows);
    return {
      labels,
      workouts,
      calories,
      total_workouts: workouts.reduce((a, b) => a + b, 0),
      total_calories: calories.reduce((a, b) => a + b, 0)
    };

  } catch (err) {
    console.error('getProgressData ERROR:', err);
    throw err;
  }
}

// GET /api/fitness/progress
router.get('/progress', auth, async (req, res, next) => {
  try {
    const data = await getProgressData(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('PROGRESS ERROR:', err); // 👈 важно
    next(err);
  }
});

// GET /api/fitness/streak
router.get('/streak', auth, async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      const streak = await getStreakRow(client, req.user.id);
      res.json({
        streak: {
          current_streak: streak.current_streak || 0,
          best_streak: streak.best_streak || 0,
          last_active_date: streak.last_active_date || null
        }
      });
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/fitness/workout/complete
router.post('/workout/complete', auth, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const {
      title,
      duration_minutes,
      calories_burned
    } = req.body;

    const workoutTitle = String(title || 'Тренировка').trim().slice(0, 150);
    const duration = Math.max(0, parseInt(duration_minutes, 10) || 30);
    const calories = Math.max(0, parseInt(calories_burned, 10) || 150);

    const today = getKzDate();

    await client.query('BEGIN');

    const existing = await client.query(`
  SELECT 1 FROM workout_logs
  WHERE user_id = $1
    AND (completed_at AT TIME ZONE 'Asia/Almaty')::date = $2
  LIMIT 1
`, [req.user.id, today]);

    let streak;

    if (existing.rows.length > 0) {
      streak = await getStreakRow(client, req.user.id);

      await client.query('COMMIT');

      return res.json({
        message: 'Уже выполнено сегодня',
        alreadyDone: true,
        streak
      });
    }

    await client.query(`
      INSERT INTO workout_logs (user_id, workout_name, duration_minutes, calories_burned)
      VALUES ($1, $2, $3, $4)
    `, [req.user.id, workoutTitle, duration, calories]);

    await client.query(`
      UPDATE workout_plans
      SET status='completed'
      WHERE user_id=$1 AND plan_date=$2
    `, [req.user.id, today]);

    streak = await touchStreak(client, req.user.id, today);

    await client.query('COMMIT');

    res.json({
      message: 'Тренировка засчитана',
      streak
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/fitness/meal
router.post('/meal', auth, async (req, res, next) => {
  try {
    const {
      meal_name,
      calories,
      protein,
      fat,
      carbs
    } = req.body;

    const name = String(meal_name || '').trim().slice(0, 150);
    if (!name) return res.status(400).json({ error: 'Укажите название еды' });

    const cal = Math.max(0, parseInt(calories, 10) || 0);
    const p = Math.max(0, parseInt(protein, 10) || 0);
    const f = Math.max(0, parseInt(fat, 10) || 0);
    const c = Math.max(0, parseInt(carbs, 10) || 0);

    await pool.query(`
      INSERT INTO meal_logs (user_id, meal_name, calories, protein, fat, carbs)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [req.user.id, name, cal, p, f, c]);

    res.json({
      message: 'Еда добавлена',
      meal: {
        meal_name: name,
        calories: cal,
        protein: p,
        fat: f,
        carbs: c
      }
    });
  } catch (err) {
    next(err);
  }
});


module.exports = router;
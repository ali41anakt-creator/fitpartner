const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { pool } = require('../config/db');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '30d'
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, 'avatar_' + req.user.id + '_' + Date.now() + path.extname(file.originalname))
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(Object.assign(new Error('Только изображения'), { status: 400 }));
  }
});

// POST /api/auth/register
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Имя обязательно'),
  body('email').isEmail().normalizeEmail().withMessage('Неверный email'),
  body('password').isLength({ min: 6 }).withMessage('Пароль минимум 6 символов')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { name, email, password, phone, age, gender, fitness_level, goals, schedule, bio, district } = req.body;

    if (await User.findByEmail(email)) {
      return res.status(400).json({ error: 'Email уже зарегистрирован' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed, phone, age, gender, fitness_level, goals, schedule, bio, district });

    res.status(201).json({
      message: 'Регистрация успешна!',
      token: signToken(user.id),
      user: User.safe(user)
    });
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Укажите email и пароль' });
    }

    const user = await User.findByEmail(email);
    console.log('USER:', user);
    console.log('PASSWORD FROM DB:', user?.password);
    if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Неверный email или пароль' });

    res.json({ message: 'Вход выполнен!', token: signToken(user.id), user: User.safe(user) });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  res.json({ user: User.safe(req.user) });
});

// PUT /api/auth/profile
router.put('/profile', auth, [
  body('name').optional().trim().notEmpty().withMessage('Имя не может быть пустым'),
  body('age').optional().isInt({ min: 14, max: 99 }).withMessage('Возраст должен быть от 14 до 99'),
  body('gender').optional().isIn(['male', 'female']).withMessage('Неверный пол')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const updated = await User.update(req.user.id, req.body);

    // Если изменились цели или уровень — сбрасываем план на текущую неделю,
    // чтобы при следующем заходе seedWeekPlan сгенерировал новый персональный план
    if (req.body.goals !== undefined || req.body.fitness_level !== undefined) {
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
      await pool.query(
        `DELETE FROM workout_plans WHERE user_id=$1 AND plan_date >= $2 AND status='planned'`,
        [req.user.id, today]
      );
    }

    res.json({ message: 'Профиль обновлён', user: User.safe(updated) });
  } catch (err) { next(err); }
});

// POST /api/auth/avatar
router.post('/avatar', auth, (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      // multer errors (размер, тип) → 400, остальные → 500
      const status = err.code === 'LIMIT_FILE_SIZE' ? 400 : (err.status || 500);
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Файл слишком большой (макс. 3MB)' : err.message;
      return res.status(status).json({ error: message });
    }
    next();
  });
}, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const avatarUrl = '/uploads/' + req.file.filename;
    await pool.query('UPDATE users SET avatar=$1 WHERE id=$2', [avatarUrl, req.user.id]);
    res.json({ avatar: avatarUrl });
  } catch (err) { next(err); }
});


// DELETE /api/auth/avatar
router.delete('/avatar', auth, async (req, res, next) => {
  try {
    const user = req.user;

    if (!user.avatar) {
      return res.status(400).json({ error: 'Нет фото' });
    }

    const fs = require('fs');
    const path = require('path');

    const filePath = path.join(__dirname, '..', user.avatar);

    // удаляем файл с диска
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // убираем из базы
    await pool.query('UPDATE users SET avatar=NULL WHERE id=$1', [user.id]);

    res.json({ message: 'Фото удалено' });

  } catch (err) {
    next(err);
  }
});
module.exports = router;

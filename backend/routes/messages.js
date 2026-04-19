const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Message = require('../models/Message');
const auth = require('../middleware/auth');

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const rand = Math.random().toString(36).slice(2);
    cb(null, 'msg_' + Date.now() + '_' + rand + path.extname(file.originalname));
  }
});

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(Object.assign(new Error('Только изображения'), { status: 400 }));
  }
});

// GET /api/messages/conversations
router.get('/conversations', auth, async (req, res, next) => {
  try {
    const conversations = await Message.getConversations(req.user.id);
    res.json({ conversations });
  } catch (err) { next(err); }
});

// GET /api/messages/unread
router.get('/unread', auth, async (req, res, next) => {
  try {
    const total = await Message.countUnread(req.user.id);
    res.json({ total });
  } catch (err) { next(err); }
});

// GET /api/messages/:userId
router.get('/:userId', auth, async (req, res, next) => {
  try {
    const partnerId = parseInt(req.params.userId);
    if (isNaN(partnerId)) return res.status(400).json({ error: 'Неверный ID пользователя' });

    const messages = await Message.getDialog(req.user.id, partnerId);
    await Message.markRead(partnerId, req.user.id);
    res.json({ messages });
  } catch (err) { next(err); }
});

// POST /api/messages/:userId
router.post('/:userId', auth, async (req, res, next) => {
  try {
    const partnerId = parseInt(req.params.userId);
    if (isNaN(partnerId)) return res.status(400).json({ error: 'Неверный ID пользователя' });

    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Пустое сообщение' });
    if (content.length > 5000) return res.status(400).json({ error: 'Слишком длинное сообщение' });

    const message = await Message.create(req.user.id, partnerId, content.trim());
    res.status(201).json({ message });
  } catch (err) { next(err); }
});

// POST /api/messages/:userId/photo — только Premium
router.post('/:userId/photo', auth, (req, res, next) => {
  const isPremium = req.user.subscription_expires && new Date(req.user.subscription_expires) > new Date();
  if (!isPremium) {
    return res.status(403).json({ error: 'Отправка фото доступна только с Premium' });
  }

  photoUpload.single('photo')(req, res, (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 400 : (err.status || 500);
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Файл слишком большой (макс. 5MB)' : err.message;
      return res.status(status).json({ error: message });
    }
    next();
  });
}, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const partnerId = parseInt(req.params.userId);
    if (isNaN(partnerId)) return res.status(400).json({ error: 'Неверный ID пользователя' });

    const imageUrl = '/uploads/' + req.file.filename;
    const message = await Message.create(req.user.id, partnerId, '[IMG]' + imageUrl);
    res.status(201).json({ message });
  } catch (err) { next(err); }
});

module.exports = router;

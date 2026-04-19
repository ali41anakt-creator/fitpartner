const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const token = header.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // Сюда попадают только JWT-ошибки (просроченный, неверная подпись и т.д.)
    return res.status(401).json({ error: 'Недействительный токен' });
  }

  // DB-ошибки отдельно — пусть идут в errorHandler как 500
  try {
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });

    // Если подписка истекла — сбрасываем прямо здесь
    if (user.subscription_expires && new Date(user.subscription_expires) < new Date()) {
      await User.deactivateSubscription(user.id);
      user.subscription_expires = null;
      user.subscription_plan = null;
    }

    await User.updateLastSeen(user.id);
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authMiddleware;

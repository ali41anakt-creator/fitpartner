// Проверяет что у пользователя активная подписка
// Используется ПОСЛЕ auth middleware
const requirePremium = (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Требуется авторизация' });

  const expires = user.subscription_expires ? new Date(user.subscription_expires) : null;
  const isActive = !!(expires && expires > new Date());

  if (!isActive) {
    return res.status(403).json({
      error: 'premium_required',
      message: 'Эта функция доступна только для подписчиков'
    });
  }

  next();
};

module.exports = requirePremium;

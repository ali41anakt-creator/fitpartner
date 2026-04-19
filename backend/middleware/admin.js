// Middleware для защиты admin-роутов
// Клиент должен передавать X-Admin-Key заголовок
module.exports = function (req, res, next) {
  const key = req.headers['x-admin-key'];

  if (!key) {
    return res.status(401).json({ error: 'Требуется ключ администратора' });
  }

  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Неверный ключ' });
  }

  next();
};

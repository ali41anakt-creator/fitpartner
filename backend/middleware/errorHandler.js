const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ERROR:`, err.message);

  if (err.code === '23505') {
    // Определяем по constraint какое поле конфликтует
    const detail = err.detail || err.constraint || '';
    if (detail.includes('email')) {
      return res.status(400).json({ error: 'Email уже зарегистрирован' });
    }
    if (detail.includes('user_id') && detail.includes('plan_date')) {
      return res.status(400).json({ error: 'План на этот день уже существует' });
    }
    if (detail.includes('from_user') || detail.includes('to_user')) {
      return res.status(400).json({ error: 'Лайк уже поставлен' });
    }
    return res.status(400).json({ error: 'Запись уже существует' });
  }
  if (err.code === '23503') return res.status(400).json({ error: 'Ошибка связи с данными' });
  if (err.code === '23514') return res.status(400).json({ error: 'Неверные данные' });

  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Внутренняя ошибка сервера' : err.message
  });
};

module.exports = errorHandler;

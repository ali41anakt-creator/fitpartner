const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ERROR:`, err.message);

  if (err.code === '23505') return res.status(400).json({ error: 'Email уже зарегистрирован' });
  if (err.code === '23503') return res.status(400).json({ error: 'Ошибка связи с данными' });
  if (err.code === '23514') return res.status(400).json({ error: 'Неверные данные' });

  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Внутренняя ошибка сервера' : err.message
  });
};

module.exports = errorHandler;

process.on('uncaughtException', (err) => { console.error('Uncaught error:', err); });
process.on('unhandledRejection', (err) => { console.error('Unhandled rejection:', err); });

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const { initDB, pool } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Создаём папку uploads при старте если нет
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] }
});

// Сначала безопасность
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));

// Лимиты запросов
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Парсинг тела
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Статичные файлы
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(uploadsDir));

// API роуты
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/subscription', require('./routes/subscription'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/admin', require('./routes/admin'));

// Проверка здоровья сервера
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', time: new Date() });
});

// SPA fallback
app.get(/^\/(?!api|css|js|uploads).*$/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/index.html'));
});

app.use(errorHandler);

// Socket.IO — реальное время
const online = new Map();

io.on('connection', (socket) => {
  socket.on('user_online', (userId) => {
    online.set(String(userId), socket.id);
    socket.userId = userId;
    io.emit('online_users', [...online.keys()]);
  });

  socket.on('send_message', ({ receiverId, message }) => {
    const sid = online.get(String(receiverId));
    if (sid) io.to(sid).emit('new_message', message);
  });

  socket.on('typing', ({ senderId, receiverId }) => {
    const sid = online.get(String(receiverId));
    if (sid) io.to(sid).emit('user_typing', { senderId });
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      online.delete(String(socket.userId));
      io.emit('online_users', [...online.keys()]);
    }
  });
});

const PORT = process.env.PORT || 3000;

(async () => {
  await initDB();
  server.listen(PORT, () => {
    console.log(`\n💪 FitPartner запущен: http://localhost:${PORT}\n`);
  });
})();

module.exports = { app, io };

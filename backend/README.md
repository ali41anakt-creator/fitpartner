# 🏋️ FitPartner PRO - Complete Fitness Partner Platform

Professional web application for finding workout partners in Almaty, Kazakhstan.

## ✨ Features

### User Features
- **Free Access**: Browse partners, view profiles, send messages
- **Premium Subscription**: Likes, photo sharing in chat, full search, priority listing
- **Real-time Chat**: Socket.io powered messaging with typing indicators
- **Profile Customization**: Upload profile photo, extensive fitness info
- **Multiple Subscription Plans**: 1, 3, and 6-month options
- **Search Filters**: By gender, fitness level, district, and goals
- **Search Limits**: Free users get 10 searches/day, Premium unlimited

### Admin Features
- **User Management**: View, grant/revoke subscriptions, delete accounts
- **Subscription Management**: Manually grant, extend, or revoke subscriptions
- **Statistics Dashboard**: Real-time user and subscription stats
- **Subscription History**: Track all subscription changes

### Contact Features
- **Contact Form**: Email notifications to admin
- **FAQ Section**: Auto-expandable Q&A
- **Multiple Contact Methods**: Email, Telegram, WhatsApp

## 🛠 Tech Stack

**Backend:**
- Node.js + Express
- PostgreSQL database
- Socket.io for real-time features
- JWT authentication
- Multer for file uploads

**Frontend:**
- Vanilla JavaScript
- Responsive CSS (Tailwind-like custom styles)
- Bebas Neue & Manrope fonts

## 📋 Setup Instructions

### Prerequisites
- Node.js (v16+)
- PostgreSQL (local or Railway)
- Git

### 1. Local Setup

```bash
# Clone/extract project
cd fitpartner_pro

# Copy environment file
cp .env.example .env

# Edit .env with your settings
nano .env

# Install dependencies
npm install

# Start PostgreSQL (if local)
# For Linux/Mac:
postgres -D /usr/local/var/postgres
# Or use your PostgreSQL service

# Run server
npm start
# or for development:
npm run dev
```

Server will start on `http://localhost:3000`

### 2. Railway Deployment

```bash
# Push to GitHub first
git push origin main

# In Railway:
1. Create new project
2. Connect GitHub repo
3. Add PostgreSQL plugin
4. Set environment variables from .env
5. Deploy

# Set DATABASE_URL automatically created by Railway
```

### 3. Database Setup

PostgreSQL will auto-create all tables on first run. No manual setup needed!

```bash
# Verify tables created:
psql -U postgres -d fitpartner -c "\dt"
```

## 🔐 Admin Access

Navigate to `/pages/admin.html` and enter your admin key from `.env`

**Default admin key (CHANGE THIS!):**
```
fitpartner_admin_2024
```

## 📱 Pages

| URL | Purpose | Auth Required |
|---|---|---|
| `/` | Landing page with stats | No |
| `/pages/register.html` | New user signup | No |
| `/pages/login.html` | User login | No |
| `/pages/contact.html` | Contact form & FAQ | No |
| `/pages/dashboard.html` | User dashboard | Yes |
| `/pages/partners.html` | Search partners | Yes |
| `/pages/messages.html` | Real-time chat | Yes |
| `/pages/profile.html` | Edit profile + logout | Yes |
| `/pages/subscription.html` | Subscription plans | Yes |
| `/pages/admin.html` | Admin panel | Admin key |

## 💳 Subscription Plans

| Plan | Duration | Price | Features |
|---|---|---|---|
| 1 Month | 30 days | 800₸ | Likes, Photos, Priority |
| 3 Months | 90 days | 2000₸ | (+ 33% discount) |
| 6 Months | 180 days | 3500₸ | (+ 45% discount) |

**Payment Method:** Kaspi.kz transfer to `+7 747 210 52 70`

## 🎯 Fitness Goals (Expandable)

Current goals:
- Похудение (Weight loss)
- Набор массы (Muscle gain)
- Рельеф и тонус (Toning)
- Бег и кардио (Running/Cardio)
- Ходьба и здоровье (Walking)
- Йога и растяжка (Yoga)
- Плавание (Swimming)
- Велоспорт (Cycling)
- Боевые искусства (Martial Arts)
- Кроссфит (CrossFit)
- Функциональный тренинг (Functional)
- Силовые показатели (Strength)
- Скалолазание (Climbing)
- Танцы и аэробика (Dance)
- Реабилитация (Rehab)

**To add more goals:**
Edit HTML select dropdowns in register.html and profile.html

## 🚀 API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/avatar` - Upload profile photo

### Users
- `GET /api/users/count` - Public user count
- `GET /api/users` - Search partners (limited for free)
- `GET /api/users/:id` - Get user profile
- `POST /api/users/:id/like` - Like user (Premium)

### Messages
- `GET /api/messages/conversations` - Get chats
- `GET /api/messages/:userId` - Get dialog
- `POST /api/messages/:userId` - Send message
- `POST /api/messages/:userId/photo` - Send photo (Premium)

### Subscription
- `GET /api/subscription/plans` - Get available plans
- `GET /api/subscription/status` - Get user subscription status
- `POST /api/subscription/activate` - Request subscription

### Contact
- `POST /api/contact/send` - Send contact form
- `GET /api/contact/info` - Get contact info

### Admin
- `GET /api/admin/users` - List all users
- `POST /api/subscription/admin/grant/:id` - Grant subscription
- `POST /api/subscription/admin/revoke/:id` - Revoke subscription
- `POST /api/subscription/admin/extend/:id` - Extend subscription
- `DELETE /api/admin/delete/:id` - Delete user

## 🎨 Customization

### Colors & Theme
Edit `/public/css/style.css` CSS variables:
```css
:root {
  --neon:    #00ff87;      /* Primary color */
  --neon2:   #00d4ff;      /* Secondary color */
  --dark:    #080c10;      /* Background */
  --text:    #e8edf2;      /* Text color */
  /* ... more variables ... */
}
```

### Search Limits
Edit in `/routes/users.js`:
```javascript
const SEARCH_LIMIT_PER_DAY = 10;      // Change free user search limit
const FREE_USER_LIMIT = 5;            // Change visible profiles for free
```

### Kaspi Payment Number
Edit in `.env`:
```
KASPI_PHONE=+7 YOUR_NUMBER
```

## 🔧 Configuration

### Email Setup (Contact Form)
For Gmail:
1. Enable 2FA in Google Account
2. Generate App Password
3. Add to `.env`:
```
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_char_app_password
```

### Admin Key
Change in `.env` (DO NOT use default):
```
ADMIN_KEY=your_super_secret_key_123
```

### JWT Secret
Change in `.env`:
```
JWT_SECRET=your_random_secret_string
```

## 📊 Database Schema

### Tables
- `users` - User profiles
- `messages` - Chat messages
- `likes` - User likes
- `subscription_plans` - Available plans
- `subscription_history` - Admin audit log

### User Fields
- id, uuid, name, email, password
- age, gender, fitness_level, goals
- schedule, bio, avatar, district
- subscription_plan, subscription_expires
- searches_today, last_search_reset

## 🐛 Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
psql -U postgres
# or
sudo service postgresql status
```

### Port Already in Use
```bash
# Kill process using port 3000
lsof -i :3000
kill -9 <PID>
```

### Multer Upload Error
Ensure `/public/uploads/` directory exists and is writable

### Socket.io Not Working
Check browser console for CORS errors. Verify `FRONTEND_URL` in `.env`

## 📈 Performance Tips

1. **Add CDN** for fonts and libraries
2. **Enable Redis** for session storage
3. **Database indexing** already optimized
4. **Image compression** for uploaded photos
5. **Lazy load** partner profiles

## 🔐 Security Checklist

- [x] HTTPS enforced (on production)
- [x] CORS configured
- [x] Rate limiting enabled
- [x] Helmet.js security headers
- [x] JWT token validation
- [x] Password hashing (bcryptjs)
- [x] Input validation (express-validator)
- [x] SQL injection prevention (parameterized queries)
- [ ] Add CAPTCHA to registration
- [ ] Add rate limiting per IP

## 📝 License

MIT - Free to modify and use

## 🤝 Support

- Email: support@fitpartner.kz
- Telegram: @fitpartner_almaty
- WhatsApp: +7 747 210 52 70

---

Made with 💚 for FitPartner Almaty

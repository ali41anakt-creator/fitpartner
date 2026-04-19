const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ PostgreSQL Error:', err.message);
    process.exit(1);
  }
  release();
  console.log('✅ PostgreSQL connected');
});

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 👇 ВОТ СЮДА
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        age SMALLINT CHECK (age >= 14 AND age <= 99),
        gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
        fitness_level VARCHAR(20) DEFAULT 'beginner',
        goals VARCHAR(255),
        schedule VARCHAR(100),
        bio TEXT,
        avatar VARCHAR(255),
        district VARCHAR(100) DEFAULT 'Алматы',
        subscription_plan VARCHAR(20),
        subscription_expires TIMESTAMPTZ,
        searches_today INTEGER DEFAULT 0,
        last_search_reset TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_seen TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_district ON users(district);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_level ON users(fitness_level);`);

    // Subscription plans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id SERIAL PRIMARY KEY,
        plan_name VARCHAR(50) NOT NULL,
        duration_days INTEGER NOT NULL,
        price_kzt INTEGER NOT NULL,
        features TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Insert default plans
    await client.query(`
      INSERT INTO subscription_plans (plan_name, duration_days, price_kzt, features)
      SELECT * FROM (VALUES
        ('1_month', 30, 800, 'Лайки,Фото в чате,Приоритет поиска'),
        ('3_months', 90, 2000, 'Лайки,Фото в чате,Приоритет поиска,Скидка 33%'),
        ('6_months', 180, 3500, 'Лайки,Фото в чате,Приоритет поиска,Скидка 45%')
      ) t(plan_name, duration_days, price_kzt, features)
      WHERE NOT EXISTS (SELECT 1 FROM subscription_plans LIMIT 1);
    `);

    // Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL CHECK (char_length(content) <= 5000),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_msg_sender ON messages(sender_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_msg_receiver ON messages(receiver_id);`);

    // Likes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        from_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(from_user, to_user)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_likes_from ON likes(from_user);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_likes_to ON likes(to_user);`);

    // Subscription history table (for admin tracking)
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan VARCHAR(50),
        duration_days INTEGER,
        action VARCHAR(50),
        admin_id INTEGER,
        kaspi_phone VARCHAR(20),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_sub_hist_user ON subscription_history(user_id);`);

    await client.query('COMMIT');
    console.log('✅ Database initialized');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ DB Error:', err.message);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };

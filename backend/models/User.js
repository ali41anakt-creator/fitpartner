const { pool } = require('../config/db');

const User = {
  async findByEmail(email) {
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1 LIMIT 1', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM users WHERE id=$1 LIMIT 1', [id]);
    return rows[0] || null;
  },

  async create({ name, email, password, phone, age, gender, fitness_level, goals, schedule, bio, district }) {
    const { rows } = await pool.query(`
      INSERT INTO users (name, email, password, phone, age, gender, fitness_level, goals, schedule, bio, district)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [name, email, password, phone||null, age||null, gender||null, fitness_level||'beginner', goals||null, schedule||null, bio||null, district||'Алматы']);
    return rows[0];
  },

  async update(id, { name, phone, age, gender, fitness_level, goals, schedule, bio, district }) {
    const { rows } = await pool.query(`
      UPDATE users SET name=$1, phone=$2, age=$3, gender=$4, fitness_level=$5, goals=$6, schedule=$7, bio=$8, district=$9
      WHERE id=$10 RETURNING *
    `, [name, phone||null, age||null, gender||null, fitness_level||'beginner', goals||null, schedule||null, bio||null, district||'Алматы', id]);
    return rows[0];
  },

  async updateLastSeen(id) { await pool.query('UPDATE users SET last_seen=NOW() WHERE id=$1', [id]); },
  async deactivateSubscription(id) { await pool.query('UPDATE users SET subscription_expires=NULL WHERE id=$1', [id]); },

  safe(user) {
    if (!user) return null;
    const { password, ...safe } = user;
    return safe;
  }
};

module.exports = User;

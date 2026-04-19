const { pool } = require('../config/db');

const Message = {
  async create(senderId, receiverId, content) {
    const { rows } = await pool.query(`
      INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *
    `, [senderId, receiverId, content]);
    return rows[0];
  },

  async getDialog(userId1, userId2) {
    const { rows } = await pool.query(`
      SELECT * FROM messages
      WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)
      ORDER BY created_at ASC
    `, [userId1, userId2]);
    return rows;
  },

  async markRead(senderId, receiverId) {
    await pool.query(`UPDATE messages SET is_read=TRUE WHERE sender_id=$1 AND receiver_id=$2 AND is_read=FALSE`, [senderId, receiverId]);
  },

  async getConversations(userId) {
    const { rows } = await pool.query(`
      WITH partners AS (
        SELECT DISTINCT CASE WHEN sender_id=$1 THEN receiver_id ELSE sender_id END AS partner_id
        FROM messages WHERE sender_id=$1 OR receiver_id=$1
      ),
      last_msgs AS (
        SELECT DISTINCT ON (CASE WHEN sender_id=$1 THEN receiver_id ELSE sender_id END)
          CASE WHEN sender_id=$1 THEN receiver_id ELSE sender_id END AS partner_id,
          content AS last_message, created_at AS last_time
        FROM messages WHERE sender_id=$1 OR receiver_id=$1
        ORDER BY CASE WHEN sender_id=$1 THEN receiver_id ELSE sender_id END, created_at DESC
      ),
      unread_counts AS (
        SELECT sender_id AS partner_id, COUNT(*) AS unread
        FROM messages WHERE receiver_id=$1 AND is_read=FALSE GROUP BY sender_id
      )
      SELECT p.partner_id, u.name, u.avatar, lm.last_message, lm.last_time, COALESCE(uc.unread, 0) AS unread
      FROM partners p JOIN users u ON u.id=p.partner_id
      LEFT JOIN last_msgs lm ON lm.partner_id=p.partner_id
      LEFT JOIN unread_counts uc ON uc.partner_id=p.partner_id
      ORDER BY lm.last_time DESC NULLS LAST
    `, [userId]);
    return rows;
  },

  async countUnread(userId) {
    const { rows } = await pool.query(`SELECT COUNT(*) AS total FROM messages WHERE receiver_id=$1 AND is_read=FALSE`, [userId]);
    return parseInt(rows[0].total);
  }
};

module.exports = Message;

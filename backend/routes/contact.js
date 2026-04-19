const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');

// Configure email (use env variables)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

// POST /api/contact/send
router.post('/send', [
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('message').trim().notEmpty().isLength({ min: 10, max: 1000 }),
  body('subject').trim().notEmpty().isLength({ max: 100 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { name, email, message, subject } = req.body;

    // Send email to admin
    if (process.env.SMTP_USER) {
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
        subject: `FitPartner: ${subject}`,
        html: `
          <h2>New contact form submission</h2>
          <p><strong>From:</strong> ${name} (${email})</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
        `
      });
    }

    res.json({
      message: 'Message sent successfully. We will respond soon!',
      success: true
    });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/contact/info
router.get('/info', (req, res) => {
  res.json({
    email: process.env.CONTACT_EMAIL || 'support@fitpartner.kz',
    telegram: process.env.TELEGRAM_USERNAME || '@fitpartner_almaty',
    whatsapp: process.env.WHATSAPP_NUMBER || '+7 747 210 52 70',
    phone: process.env.PHONE_NUMBER || '+7 747 210 52 70'
  });
});

module.exports = router;

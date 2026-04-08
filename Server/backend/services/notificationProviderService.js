const { logger } = require('../utils/logger');

let smtpTransporter;

function buildMessage(payload) {
  const template = payload.template || 'generic';
  const data = payload.data || {};

  if (template === 'mfa_otp') {
    const code = data.otp || '******';
    const expiresInMin = data.expiresInMin || 5;
    return {
      subject: 'Your Modern Library OTP',
      text: `Your Modern Library verification code is ${code}. It expires in ${expiresInMin} minute(s).`,
      html: `<p>Your Modern Library verification code is <strong>${code}</strong>.</p><p>It expires in ${expiresInMin} minute(s).</p>`,
    };
  }

  return {
    subject: payload.subject || 'Modern Library Notification',
    text: payload.text || JSON.stringify(data),
    html: payload.html || `<pre>${JSON.stringify(data, null, 2)}</pre>`,
  };
}

function getEmailProvider() {
  return String(process.env.NOTIFICATION_EMAIL_PROVIDER || 'log').toLowerCase();
}

function getSmsProvider() {
  return String(process.env.NOTIFICATION_SMS_PROVIDER || 'log').toLowerCase();
}

function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;
  // Lazy load for optional dependency path.
  // eslint-disable-next-line global-require
  const nodemailer = require('nodemailer');
  smtpTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
  });
  return smtpTransporter;
}

async function sendEmail(payload) {
  const provider = getEmailProvider();
  const to = payload.to;
  const msg = buildMessage(payload);

  if (!to) return { delivered: false, provider, reason: 'missing_recipient' };

  if (provider === 'smtp') {
    const from = process.env.SMTP_FROM;
    if (!from || !process.env.SMTP_HOST) {
      return { delivered: false, provider, reason: 'smtp_not_configured' };
    }

    const transporter = getSmtpTransporter();
    const result = await transporter.sendMail({
      from,
      to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    return { delivered: true, provider, messageId: result.messageId };
  }

  logger.info({ to, msg }, 'notification_email_log_provider');
  return { delivered: true, provider: 'log', messageId: null };
}

async function sendSms(payload) {
  const provider = getSmsProvider();
  const to = payload.to;
  const msg = buildMessage(payload);

  if (!to) return { delivered: false, provider, reason: 'missing_recipient' };

  if (provider === 'twilio') {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM) {
      return { delivered: false, provider, reason: 'twilio_not_configured' };
    }
    // Lazy load for optional dependency path.
    // eslint-disable-next-line global-require
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const result = await client.messages.create({
      from: process.env.TWILIO_FROM,
      to,
      body: msg.text,
    });
    return { delivered: true, provider, messageId: result.sid };
  }

  logger.info({ to, msg }, 'notification_sms_log_provider');
  return { delivered: true, provider: 'log', messageId: null };
}

async function sendNotification(payload) {
  const channel = payload.channel || 'in_app';

  if (channel === 'email') return sendEmail(payload);
  if (channel === 'sms') return sendSms(payload);

  logger.info({ payload }, 'notification_in_app_log_provider');
  return { delivered: true, provider: 'in_app', messageId: null };
}

module.exports = { sendNotification, buildMessage };

const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || 'rineetpandey@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'true') === 'true';

let transporter;

function getTransporter() {
  if (!SMTP_PASS) {
    throw new Error('SMTP_PASS is not configured');
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
  }
  return transporter;
}

async function sendMail({ to, cc, bcc, subject, text, html, attachments }) {
  const transport = getTransporter();
  return transport.sendMail({
    from: `CampusFlow <${SMTP_USER}>`,
    to,
    cc,
    bcc,
    subject,
    text,
    html,
    attachments
  });
}

module.exports = { sendMail };
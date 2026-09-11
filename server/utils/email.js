const nodemailer = require('nodemailer');

// Configure Transporter (Gmail API / SMTP or Ethereal / Log fallback)
function getTransporter() {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER || 'trackathleteadmin@gmail.com';
  const pass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || 'oiixwczbjrniertz').replace(/\s+/g, '');

  if (user && pass) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }

  // Fallback transporter (Logs verification codes cleanly to server log so app never fails if SMTP env vars aren't set)
  return {
    async sendMail(options) {
      console.log('====================================================');
      console.log('📧 [MOCK EMAIL DELIVERED TO LOG]');
      console.log(`TO: ${options.to}`);
      console.log(`SUBJECT: ${options.subject}`);
      console.log(`BODY:\n${options.text || options.html}`);
      console.log('====================================================');
      return { messageId: 'mock-email-' + Date.now() };
    }
  };
}

/**
 * Send 6-digit email verification code
 */
async function sendVerificationEmail(toEmail, code) {
  const transporter = getTransporter();
  const mailOptions = {
    from: `"TrackAthlete Verification" <${process.env.GMAIL_USER || 'no-reply@trackathlete.org'}>`,
    to: toEmail,
    subject: 'TrackAthlete Email Verification',
    text: `Your TrackAthlete 6-digit verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #d8ded5; rounded: 12px; background: #fcfcf8;">
        <h2 style="color: #173235; margin-bottom: 8px;">TrackAthlete Email Verification</h2>
        <p style="color: #526668; font-size: 14px;">Welcome to TrackAthlete! Please use the 6-digit code below to verify your account:</p>
        <div style="background: #e2eee4; border: 1px solid #2f6d5a; padding: 16px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #194e42;">${code}</span>
        </div>
        <p style="color: #526668; font-size: 12px;">This verification code expires in <strong>10 minutes</strong>. If you did not create a TrackAthlete account, please ignore this email.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error('Failed to send verification email:', err.message);
    // Still log code to console so user can complete registration
    console.log(`[FALLBACK CODE FOR ${toEmail}]: ${code}`);
    return false;
  }
}

/**
 * Send 6-digit password reset code
 */
async function sendPasswordResetEmail(toEmail, code) {
  const transporter = getTransporter();
  const mailOptions = {
    from: `"TrackAthlete Security" <${process.env.GMAIL_USER || 'no-reply@trackathlete.org'}>`,
    to: toEmail,
    subject: 'TrackAthlete Password Reset Request',
    text: `Your TrackAthlete 6-digit password reset code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #d8ded5; rounded: 12px; background: #fcfcf8;">
        <h2 style="color: #173235; margin-bottom: 8px;">TrackAthlete Password Reset</h2>
        <p style="color: #526668; font-size: 14px;">We received a request to reset your password. Use the 6-digit code below to continue:</p>
        <div style="background: #fff3f0; border: 1px solid #efcbc3; padding: 16px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #e07050;">${code}</span>
        </div>
        <p style="color: #526668; font-size: 12px;">This code expires in <strong>10 minutes</strong>. If you did not request a password reset, please secure your account immediately.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error('Failed to send password reset email:', err.message);
    console.log(`[FALLBACK RESET CODE FOR ${toEmail}]: ${code}`);
    return false;
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};

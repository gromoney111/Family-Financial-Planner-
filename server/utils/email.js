const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send verification email
const sendVerificationEmail = async (user, verificationToken) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
  const verifyLink = `${frontendUrl}/api/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(user.email)}`;

  const mailOptions = {
    from: `"GromoFinance" <${process.env.SMTP_USER || 'noreply@gromofinance.com'}>`,
    to: user.email,
    subject: '✅ Verify Your Email - GromoFinance',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px;">
        <div style="text-align:center;padding:20px 0;border-bottom:2px solid #f59e0b;">
          <h1 style="color:#0f172a;margin:0;">Gromo<span style="color:#f59e0b;">Finance</span></h1>
          <p style="color:#64748b;margin-top:4px;">Smart Family Budget Planner</p>
        </div>
        <div style="padding:30px 20px;text-align:center;">
          <h2 style="color:#0f172a;">Welcome, ${user.name}! 🎉</h2>
          <p style="color:#475569;font-size:16px;line-height:1.6;">
            Thank you for registering on GromoFinance. Please verify your email address to activate your account.
          </p>
          <a href="${verifyLink}" style="display:inline-block;margin:24px 0;padding:14px 32px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#ffffff;font-weight:600;font-size:16px;text-decoration:none;border-radius:8px;box-shadow:0 4px 12px rgba(245,158,11,0.3);">
            Verify My Email
          </a>
          <p style="color:#94a3b8;font-size:13px;margin-top:16px;">
            This link expires in 24 hours. If you didn't create an account, please ignore this email.
          </p>
        </div>
        <div style="text-align:center;padding:16px 0;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:12px;margin:0;">© 2024 GromoFinance | gromofinance.com</p>
        </div>
      </div>
    `
  };

  try {
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error.message);
    return { success: false, error: error.message };
  }
};

// Send welcome email after verification
const sendWelcomeEmail = async (user) => {
  const mailOptions = {
    from: `"GromoFinance" <${process.env.SMTP_USER || 'noreply@gromofinance.com'}>`,
    to: user.email,
    subject: '🎉 Welcome to GromoFinance - Account Verified!',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px;">
        <div style="text-align:center;padding:20px 0;border-bottom:2px solid #f59e0b;">
          <h1 style="color:#0f172a;margin:0;">Gromo<span style="color:#f59e0b;">Finance</span></h1>
        </div>
        <div style="padding:30px 20px;text-align:center;">
          <h2 style="color:#0f172a;">Account Verified! ✅</h2>
          <p style="color:#475569;font-size:16px;line-height:1.6;">
            Hi ${user.name}, your email is verified. You can now fully access all features of GromoFinance.
          </p>
          <ul style="text-align:left;color:#475569;font-size:14px;line-height:2;padding-left:20px;">
            <li>Track income & expenses for up to 6 family members</li>
            <li>Set budget goals with alerts</li>
            <li>Track loans, EMIs, and investments</li>
            <li>Generate PDF reports</li>
          </ul>
          <a href="${process.env.FRONTEND_URL || 'https://gromofinance.com'}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#0f172a;color:#f59e0b;font-weight:600;text-decoration:none;border-radius:8px;">
            Go to Dashboard →
          </a>
        </div>
        <div style="text-align:center;padding:16px 0;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:12px;margin:0;">© 2024 GromoFinance | gromofinance.com</p>
        </div>
      </div>
    `
  };

  try {
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Welcome email error:', error.message);
    return { success: false, error: error.message };
  }
};

// Send password reset email
const sendPasswordResetEmail = async (user, resetToken) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
  const resetLink = `${frontendUrl}?resetToken=${resetToken}`;

  const mailOptions = {
    from: `"GromoFinance" <${process.env.SMTP_USER || 'noreply@gromofinance.com'}>`,
    to: user.email,
    subject: '🔑 Password Reset - GromoFinance',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f8fafc;border-radius:12px;">
        <div style="text-align:center;padding:20px 0;border-bottom:2px solid #f59e0b;">
          <h1 style="color:#0f172a;margin:0;">Gromo<span style="color:#f59e0b;">Finance</span></h1>
        </div>
        <div style="padding:30px 20px;text-align:center;">
          <h2 style="color:#0f172a;">Password Reset Request</h2>
          <p style="color:#475569;font-size:16px;line-height:1.6;">
            Hi ${user.name}, we received a request to reset your password. Click the button below:
          </p>
          <a href="${resetLink}" style="display:inline-block;margin:24px 0;padding:14px 32px;background:#dc2626;color:#ffffff;font-weight:600;font-size:16px;text-decoration:none;border-radius:8px;">
            Reset Password
          </a>
          <p style="color:#94a3b8;font-size:13px;margin-top:16px;">
            This link expires in 1 hour. If you didn't request this, ignore this email.
          </p>
        </div>
      </div>
    `
  };

  try {
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Reset email error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail };

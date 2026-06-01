const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const Family = require('../models/Family');
const { authenticate, generateToken } = require('../middleware/auth');
const { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/email');

// ============ REGISTER (Creates Admin + Family) ============
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, familyCode, inviteCode } = req.body;

    // Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    // Check if user already exists (email OR phone - must be unique across ALL families)
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'This email is already registered. Each person can only have one account.' });
    }

    const existingPhone = await User.findOne({ phone: phone.trim() });
    if (existingPhone) {
      return res.status(400).json({ success: false, message: 'This phone number is already registered. Each person can only have one account.' });
    }

    let family;

    // Case 1: Joining via invite code
    if (inviteCode) {
      family = await Family.findOne({ inviteCode });
      if (!family) {
        return res.status(400).json({ success: false, message: 'Invalid invite code.' });
      }
      if (!family.isInviteValid()) {
        return res.status(400).json({ success: false, message: 'Invite code has expired. Ask admin for a new one.' });
      }
      if (family.isFull()) {
        return res.status(400).json({ success: false, message: 'Family has reached maximum members (6).' });
      }

      // Create member user
      const user = await User.create({
        name,
        email: email.toLowerCase(),
        phone,
        password,
        role: 'member',
        relation: 'Other',
        familyId: family._id
      });

      // Add to family members
      family.members.push(user._id);
      await family.save();

      const token = generateToken(user._id);
      return res.status(201).json({
        success: true,
        message: 'Registered and joined family successfully!',
        token,
        user: user.toSafeObject(),
        familyCode: family.familyCode
      });
    }

    // Case 2: Creating new family (Admin registration)
    const code = familyCode || `family_${Date.now().toString(36)}`;
    
    // Check if family code already exists
    const existingFamily = await Family.findOne({ familyCode: code.toLowerCase() });
    if (existingFamily) {
      return res.status(400).json({ success: false, message: 'Family code already taken. Please choose another.' });
    }

    // Create family first (without admin reference)
    family = new Family({
      familyCode: code.toLowerCase(),
      familyName: `${name}'s Family`,
      adminId: null, // Will update after user creation
      members: [],
      settings: { currency: '₹', locale: 'en-IN' }
    });

    // Temporarily save without adminId validation
    family = await Family.create({
      familyCode: code.toLowerCase(),
      familyName: `${name}'s Family`,
      adminId: new require('mongoose').Types.ObjectId(), // Placeholder
      members: [],
      settings: { currency: '₹', locale: 'en-IN' }
    });

    // Create admin user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password,
      role: 'admin',
      relation: 'Self',
      familyId: family._id
    });

    // Update family with correct admin and add to members
    family.adminId = user._id;
    family.members.push(user._id);
    await family.save();

    // Send verification email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    user.emailVerificationExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // Send email (non-blocking - don't fail registration if email fails)
    sendVerificationEmail(user, verificationToken).catch(err => {
      console.log('Verification email could not be sent:', err);
    });

    const token = generateToken(user._id);
    res.status(201).json({
      success: true,
      message: 'Account created successfully! Please check your email to verify your account.',
      token,
      user: user.toSafeObject(),
      familyCode: family.familyCode
    });
  } catch (error) {
    console.error('Register error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email or phone already registered.' });
    }
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
});

// ============ LOGIN ============
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Email/phone and password are required.' });
    }

    // Find user by email or phone
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { phone: identifier }
      ]
    }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated. Contact your family admin.' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Get family info
    const family = await Family.findById(user.familyId);

    const token = generateToken(user._id);
    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: user.toSafeObject(),
      familyCode: family?.familyCode || ''
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
});

// ============ GET CURRENT USER ============
router.get('/me', authenticate, async (req, res) => {
  try {
    const family = await Family.findById(req.user.familyId);
    res.json({
      success: true,
      user: req.user.toSafeObject(),
      familyCode: family?.familyCode || ''
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get user info.' });
  }
});

// ============ FORGOT PASSWORD ============
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if email exists
      return res.json({ success: true, message: 'If this email is registered, a reset link will be sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetTokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // TODO: Send email with reset link
    // For now, return token (in production, send via email only)
    res.json({
      success: true,
      message: 'Password reset instructions sent to your email.',
      // Remove this in production - only for development
      ...(process.env.NODE_ENV !== 'production' && { resetToken })
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to process reset request.' });
  }
});

// ============ RESET PASSWORD ============
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetToken: hashedToken,
      resetTokenExpiry: { $gt: Date.now() }
    }).select('+password');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    user.password = newPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successful. You can now login.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
});

// ============ CHANGE PASSWORD ============
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.userId).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
});

// ============ VERIFY EMAIL ============
router.get('/verify-email', async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).send('<h2>Invalid verification link.</h2>');
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      email: email.toLowerCase(),
      emailVerificationToken: hashedToken,
      emailVerificationExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).send(`
        <div style="font-family:Arial,sans-serif;text-align:center;padding:60px 20px;">
          <h2 style="color:#dc2626;">❌ Verification Failed</h2>
          <p>This link is invalid or has expired. Please request a new verification email.</p>
          <a href="${process.env.FRONTEND_URL || '/'}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#f59e0b;color:#fff;border-radius:8px;text-decoration:none;">Go to Login</a>
        </div>
      `);
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpiry = undefined;
    await user.save();

    // Send welcome email
    sendWelcomeEmail(user).catch(err => console.log('Welcome email error:', err));

    res.send(`
      <div style="font-family:Arial,sans-serif;text-align:center;padding:60px 20px;">
        <h2 style="color:#0d9488;">✅ Email Verified Successfully!</h2>
        <p style="color:#475569;font-size:16px;">Hi ${user.name}, your email is now verified. You can use all features of GromoFinance.</p>
        <a href="${process.env.FRONTEND_URL || '/'}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#f59e0b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Go to Dashboard →</a>
      </div>
    `);
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).send('<h2>Something went wrong. Please try again.</h2>');
  }
});

// ============ RESEND VERIFICATION EMAIL ============
router.post('/resend-verification', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (user.isEmailVerified) {
      return res.json({ success: true, message: 'Email is already verified.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    user.emailVerificationExpiry = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    const result = await sendVerificationEmail(user, verificationToken);
    if (result.success) {
      res.json({ success: true, message: 'Verification email sent! Check your inbox.' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send email. Please try again later.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to resend verification.' });
  }
});

module.exports = router;

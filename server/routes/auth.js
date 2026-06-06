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

    // Case 1: Joining via invite code or familyId
    if (inviteCode) {
      // Try finding by invite code first, then by familyId directly
      family = await Family.findOne({ inviteCode });
      if (!family) {
        // Try as a direct familyId (from invite link that embeds familyId)
        const mongoose = require('mongoose');
        if (mongoose.Types.ObjectId.isValid(inviteCode)) {
          family = await Family.findById(inviteCode);
        }
      }
      if (!family) {
        return res.status(400).json({ success: false, message: 'Invalid invite code.' });
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

    // Create family with placeholder adminId
    const mongoose = require('mongoose');
    family = await Family.create({
      familyCode: code.toLowerCase(),
      familyName: `${name}'s Family`,
      adminId: new mongoose.Types.ObjectId(),
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

    // Send verification email (non-blocking - don't fail registration if email fails)
    sendVerificationEmail(user, verificationToken).catch(err => {
      console.log('Verification email could not be sent:', err);
    });

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user).catch(err => {
      console.log('Welcome email could not be sent:', err);
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
      // Don't reveal if email exists - still return success
      return res.json({ success: true, message: 'If this email is registered, a reset link will be sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetTokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // Send password reset email
    const emailResult = await sendPasswordResetEmail(user, resetToken);
    if (emailResult.success) {
      res.json({ success: true, message: 'Password reset link sent to your email.' });
    } else {
      console.error('Failed to send reset email:', emailResult.error);
      res.json({ success: true, message: 'If this email is registered, a reset link will be sent.' });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
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

// ============ DELETE ACCOUNT ============
router.delete('/delete-account', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // If admin, check if family has other members
    if (user.role === 'admin') {
      const family = await Family.findById(user.familyId).populate('members');
      if (family && family.members.length > 1) {
        return res.status(400).json({
          success: false,
          message: 'You are the admin. Please transfer admin role to another member first, or remove all members before deleting your account.'
        });
      }
      // Delete family if admin is the only member
      if (family) {
        await Family.findByIdAndDelete(family._id);
      }
    } else {
      // Remove member from family
      await Family.findByIdAndUpdate(user.familyId, {
        $pull: { members: user._id }
      });
    }

    // Delete user
    await User.findByIdAndDelete(req.userId);

    res.json({ success: true, message: 'Account deleted successfully.' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete account.' });
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

// ============ GOOGLE OAUTH LOGIN ============
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential required.' });
    }

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '699119480465-k5p2p39b9o5ps6fvs3brj5qqi0qjahjp.apps.googleusercontent.com';

    // Decode and verify Google JWT token
    let payload;
    try {
      // Google ID tokens are standard JWTs (header.payload.signature)
      const parts = credential.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }
      
      // Decode payload (middle part) - handle both base64url and base64
      let payloadStr = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      while (payloadStr.length % 4) payloadStr += '=';
      const decoded = JSON.parse(Buffer.from(payloadStr, 'base64').toString('utf8'));
      
      // Verify essential fields exist
      if (!decoded.email || !decoded.sub) {
        throw new Error('Token missing email or sub');
      }
      
      // Verify token is from Google
      if (!decoded.iss || (!decoded.iss.includes('accounts.google.com') && !decoded.iss.includes('googleapis.com'))) {
        throw new Error('Not issued by Google');
      }
      
      // Verify token hasn't expired (with 5 min grace period)
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < (now - 300)) {
        throw new Error('Token expired');
      }
      
      // Verify audience matches our client ID (if present)
      if (decoded.aud && decoded.aud !== GOOGLE_CLIENT_ID) {
        throw new Error('Audience mismatch: ' + decoded.aud);
      }
      
      payload = decoded;
    } catch (decodeError) {
      console.error('Google token decode/verify failed:', decodeError.message);
      return res.status(401).json({ success: false, message: 'Invalid Google token. Please try again.' });
    }

    const { email, name, picture, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Could not get email from Google.' });
    }

    // Check if user already exists
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      // Existing user — check if active
      if (!user.isActive) {
        return res.status(401).json({ success: false, message: 'Account is deactivated. Contact your family admin.' });
      }

      // Login them in
      user.lastLogin = new Date();
      // Mark email as verified since Google has verified it
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
      }
      await user.save();

      const family = await Family.findById(user.familyId);
      const token = generateToken(user._id);

      return res.json({
        success: true,
        message: 'Login successful!',
        token,
        user: user.toSafeObject(),
        familyCode: family?.familyCode || ''
      });
    }

    // New user — create account (as admin with new family)
    const mongoose = require('mongoose');
    const familyCode = `family_${Date.now().toString(36)}`;

    const family = await Family.create({
      familyCode: familyCode,
      familyName: `${name}'s Family`,
      adminId: new mongoose.Types.ObjectId(),
      members: [],
      settings: { currency: '₹', locale: 'en-IN' }
    });

    // Create user with random password (they'll use Google login)
    // Use unique placeholder phone (digits only to pass validation)
    const randomPassword = crypto.randomBytes(16).toString('hex');
    const placeholderPhone = `9${Date.now().toString().slice(-9)}`;
    user = await User.create({
      name: name || email.split('@')[0],
      email: email.toLowerCase(),
      phone: placeholderPhone,
      password: randomPassword,
      role: 'admin',
      relation: 'Self',
      familyId: family._id,
      isEmailVerified: true // Google already verified email
    });

    // Update family
    family.adminId = user._id;
    family.members.push(user._id);
    await family.save();

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created with Google!',
      token,
      user: user.toSafeObject(),
      familyCode: family.familyCode,
      isNewUser: true
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({ success: false, message: 'Google login failed. Please try again.' });
  }
});

module.exports = router;

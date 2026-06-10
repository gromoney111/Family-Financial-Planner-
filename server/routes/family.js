const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Family = require('../models/Family');
const { authenticate, requireAdmin, generateToken } = require('../middleware/auth');

// ============ GET FAMILY INFO ============
router.get('/', authenticate, async (req, res) => {
  try {
    const family = await Family.findById(req.familyId).populate('members', 'name email phone role relation isActive lastLogin');
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found.' });
    }
    res.json({
      success: true,
      family: {
        id: family._id,
        familyCode: family.familyCode,
        familyName: family.familyName,
        adminId: family.adminId,
        members: family.members,
        maxMembers: family.maxMembers,
        settings: family.settings,
        createdAt: family.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get family info.' });
  }
});

// ============ GET ALL FAMILY MEMBERS ============
router.get('/members', authenticate, async (req, res) => {
  try {
    const members = await User.find({ familyId: req.familyId, isActive: true })
      .select('name email phone role relation lastLogin createdAt');
    res.json({ success: true, members });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get members.' });
  }
});

// ============ ADD MEMBER (Admin Only) ============
router.post('/members', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, password, role, relation } = req.body;

    // Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, phone, and password are required.' });
    }

    // Check family member limit (subscription-aware)
    const family = await Family.findById(req.familyId);
    const Subscription = require('../models/Subscription');
    const familySub = await Subscription.findOne({ familyId: req.familyId });
    const maxAllowed = familySub ? familySub.maxMembers : 3;
    if (family.members.length >= maxAllowed) {
      return res.status(400).json({ success: false, message: `Maximum ${maxAllowed} members allowed on your plan. Upgrade to add more.` });
    }

    // Check if email already exists (globally unique)
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'This email is already registered by another user. Each email must be unique.' });
    }

    // Check if phone already exists (globally unique)
    const existingPhone = await User.findOne({ phone: phone.trim() });
    if (existingPhone) {
      return res.status(400).json({ success: false, message: 'This phone number is already registered by another user. Each phone must be unique.' });
    }

    // Create new member
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password,
      role: role || 'member',
      relation: relation || 'Other',
      familyId: req.familyId
    });

    // Add to family
    family.members.push(user._id);
    await family.save();

    res.status(201).json({
      success: true,
      message: `${name} added to family! They can now login with their email and password.`,
      member: user.toSafeObject()
    });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ success: false, message: 'Failed to add member.' });
  }
});

// ============ UPDATE MEMBER (Admin Only) ============
router.put('/members/:memberId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { name, phone, role, relation } = req.body;

    const member = await User.findOne({ _id: memberId, familyId: req.familyId });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    if (name) member.name = name;
    if (phone) member.phone = phone;
    if (role && (role === 'admin' || role === 'member')) member.role = role;
    if (relation) member.relation = relation;

    await member.save();
    res.json({ success: true, message: 'Member updated.', member: member.toSafeObject() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update member.' });
  }
});

// ============ REMOVE MEMBER (Admin Only) ============
router.delete('/members/:memberId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { memberId } = req.params;

    // Can't remove yourself (admin)
    if (memberId === req.userId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot remove yourself. Transfer admin first.' });
    }

    const member = await User.findOne({ _id: memberId, familyId: req.familyId });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    // Soft delete - deactivate
    member.isActive = false;
    await member.save();

    // Remove from family members array
    await Family.findByIdAndUpdate(req.familyId, {
      $pull: { members: memberId }
    });

    res.json({ success: true, message: `${member.name} removed from family.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to remove member.' });
  }
});

// ============ GENERATE INVITE LINK (Admin Only) ============
router.post('/invite', authenticate, requireAdmin, async (req, res) => {
  try {
    const family = await Family.findById(req.familyId);
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found.' });
    }
    if (family.isFull()) {
      return res.status(400).json({ success: false, message: 'Family is full. Cannot invite more members.' });
    }

    const inviteCode = family.generateInviteCode();
    await family.save();

    const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5000';
    const inviteLink = `${frontendUrl}?invite=${inviteCode}`;

    res.json({
      success: true,
      inviteCode,
      inviteLink,
      expiresAt: family.inviteExpiry,
      message: 'Invite link generated! Valid for 7 days.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate invite.' });
  }
});

// ============ VALIDATE INVITE CODE ============
router.get('/invite/:code', async (req, res) => {
  try {
    const { code } = req.params;
    let family = await Family.findOne({ inviteCode: code }).populate('adminId', 'name');

    // Also try finding by familyId (invite links embed familyId directly)
    if (!family) {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(code)) {
        family = await Family.findById(code).populate('adminId', 'name');
      }
    }

    if (!family) {
      return res.status(404).json({ success: false, message: 'Invalid invite code.' });
    }
    if (family.inviteExpiry && !family.isInviteValid()) {
      return res.status(400).json({ success: false, message: 'Invite code has expired.' });
    }

    res.json({
      success: true,
      familyName: family.familyName,
      adminName: family.adminId?.name || 'Admin',
      memberCount: family.members.length,
      maxMembers: family.maxMembers
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to validate invite.' });
  }
});

// ============ TRANSFER ADMIN ROLE ============
router.post('/transfer-admin', authenticate, requireAdmin, async (req, res) => {
  try {
    const { newAdminId } = req.body;
    
    const newAdmin = await User.findOne({ _id: newAdminId, familyId: req.familyId });
    if (!newAdmin) {
      return res.status(404).json({ success: false, message: 'Member not found in your family.' });
    }

    // Update roles
    req.user.role = 'member';
    await req.user.save();

    newAdmin.role = 'admin';
    await newAdmin.save();

    // Update family
    await Family.findByIdAndUpdate(req.familyId, { adminId: newAdmin._id });

    res.json({ success: true, message: `Admin role transferred to ${newAdmin.name}.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to transfer admin.' });
  }
});

// ============ UPDATE FAMILY SETTINGS ============
router.put('/settings', authenticate, requireAdmin, async (req, res) => {
  try {
    const { currency, locale, familyName } = req.body;
    const family = await Family.findById(req.familyId);

    if (currency) family.settings.currency = currency;
    if (locale) family.settings.locale = locale;
    if (familyName) family.familyName = familyName;

    await family.save();
    res.json({ success: true, message: 'Family settings updated.', settings: family.settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update settings.' });
  }
});

module.exports = router;

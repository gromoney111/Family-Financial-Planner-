const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Family = require('../models/Family');
const Transaction = require('../models/Transaction');
const Loan = require('../models/Loan');
const Investment = require('../models/Investment');

// Super Admin Authentication Middleware
const superAdminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Admin access required.' });
  }

  const token = authHeader.replace('Bearer ', '');
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@gromofinance.com';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin123';

  // Simple token check: base64(email:password)
  const expectedToken = Buffer.from(`${adminEmail}:${adminPassword}`).toString('base64');
  if (token !== expectedToken) {
    return res.status(403).json({ success: false, message: 'Invalid admin credentials.' });
  }
  next();
};

// ============ ADMIN LOGIN ============
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@gromofinance.com';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin123';

  if (email === adminEmail && password === adminPassword) {
    const token = Buffer.from(`${adminEmail}:${adminPassword}`).toString('base64');
    return res.json({ success: true, token, message: 'Admin login successful.' });
  }
  return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
});

// ============ DASHBOARD STATS ============
router.get('/stats', superAdminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalFamilies = await Family.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const verifiedUsers = await User.countDocuments({ isEmailVerified: true });
    const totalTransactions = await Transaction.countDocuments();
    const totalLoans = await Loan.countDocuments();
    const totalInvestments = await Investment.countDocuments();

    // Users registered in last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsersThisWeek = await User.countDocuments({ createdAt: { $gte: weekAgo } });
    const newFamiliesThisWeek = await Family.countDocuments({ createdAt: { $gte: weekAgo } });

    // Monthly registrations (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyRegistrations = await User.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalFamilies,
        activeUsers,
        verifiedUsers,
        unverifiedUsers: totalUsers - verifiedUsers,
        totalTransactions,
        totalLoans,
        totalInvestments,
        newUsersThisWeek,
        newFamiliesThisWeek,
        monthlyRegistrations
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get stats.' });
  }
});

// ============ LIST ALL USERS ============
router.get('/users', superAdminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, verified, active } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    if (verified === 'true') filter.isEmailVerified = true;
    if (verified === 'false') filter.isEmailVerified = false;
    if (active === 'true') filter.isActive = true;
    if (active === 'false') filter.isActive = false;

    const users = await User.find(filter)
      .populate('familyId', 'familyCode familyName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      users: users.map(u => ({
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        relation: u.relation,
        isActive: u.isActive,
        isEmailVerified: u.isEmailVerified,
        familyCode: u.familyId?.familyCode || 'N/A',
        familyName: u.familyId?.familyName || 'N/A',
        createdAt: u.createdAt,
        lastLogin: u.lastLogin
      })),
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get users.' });
  }
});

// ============ LIST ALL FAMILIES ============
router.get('/families', superAdminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const families = await Family.find()
      .populate('adminId', 'name email')
      .populate('members', 'name email role isActive')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Family.countDocuments();

    res.json({
      success: true,
      families: families.map(f => ({
        id: f._id,
        familyCode: f.familyCode,
        familyName: f.familyName,
        adminName: f.adminId?.name || 'Unknown',
        adminEmail: f.adminId?.email || 'Unknown',
        memberCount: f.members.length,
        maxMembers: f.maxMembers,
        members: f.members.map(m => ({
          name: m.name,
          email: m.email,
          role: m.role,
          isActive: m.isActive
        })),
        isActive: f.isActive,
        createdAt: f.createdAt
      })),
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get families.' });
  }
});

// ============ GET SINGLE USER DETAILS ============
router.get('/users/:id', superAdminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('familyId');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const transactions = await Transaction.countDocuments({ userId: user._id });
    const loans = await Loan.countDocuments({ userId: user._id });
    const investments = await Investment.countDocuments({ userId: user._id });

    res.json({
      success: true,
      user: {
        ...user.toSafeObject(),
        isEmailVerified: user.isEmailVerified,
        familyCode: user.familyId?.familyCode,
        familyName: user.familyId?.familyName,
        stats: { transactions, loans, investments }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get user.' });
  }
});

// ============ DEACTIVATE/ACTIVATE USER ============
router.put('/users/:id/toggle-active', superAdminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully.`,
      isActive: user.isActive
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user.' });
  }
});

// ============ DELETE FAMILY ============
router.delete('/families/:id', superAdminAuth, async (req, res) => {
  try {
    const family = await Family.findById(req.params.id);
    if (!family) return res.status(404).json({ success: false, message: 'Family not found.' });

    // Deactivate all members
    await User.updateMany({ familyId: family._id }, { isActive: false });
    family.isActive = false;
    await family.save();

    res.json({ success: true, message: 'Family deactivated and all members disabled.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete family.' });
  }
});

// ============ SUBSCRIPTION & PAYMENT STATS ============
router.get('/subscriptions', superAdminAuth, async (req, res) => {
  try {
    const Subscription = require('../models/Subscription');
    const Insurance = require('../models/Insurance');

    const totalSubs = await Subscription.countDocuments();
    const freeSubs = await Subscription.countDocuments({ plan: 'free' });
    const proSubs = await Subscription.countDocuments({ plan: 'pro', status: { $in: ['active', 'trial'] } });
    const enterpriseSubs = await Subscription.countDocuments({ plan: 'enterprise', status: 'active' });
    const trialSubs = await Subscription.countDocuments({ status: 'trial' });
    const totalInsurance = await Insurance.countDocuments();

    // Revenue calculation
    const paidSubs = await Subscription.find({ 'paymentHistory.0': { $exists: true } });
    let totalRevenue = 0;
    paidSubs.forEach(s => {
      s.paymentHistory.forEach(p => {
        if (p.status === 'success') totalRevenue += p.amount;
      });
    });

    // Pending withdrawals
    const pendingWithdrawals = await Subscription.find({ 'withdrawalHistory': { $elemMatch: { status: 'pending' } } });
    let pendingAmount = 0;
    pendingWithdrawals.forEach(s => {
      s.withdrawalHistory.forEach(w => { if (w.status === 'pending') pendingAmount += w.amount; });
    });

    // Coupon usage
    const couponUsage = await Subscription.aggregate([
      { $match: { couponCode: { $exists: true, $ne: null } } },
      { $group: { _id: '$couponCode', count: { $sum: 1 } } }
    ]);

    // Referral stats
    const totalReferrals = await Subscription.countDocuments({ referredBy: { $exists: true, $ne: null } });

    res.json({
      success: true,
      subscriptions: {
        total: totalSubs,
        free: freeSubs,
        pro: proSubs,
        enterprise: enterpriseSubs,
        trial: trialSubs,
        totalInsurance,
        totalRevenue,
        pendingWithdrawals: pendingAmount,
        couponUsage,
        totalReferrals
      }
    });
  } catch (error) {
    console.error('Admin subs error:', error);
    res.status(500).json({ success: false, message: 'Failed to get subscription stats.' });
  }
});

// ============ RECENT ACTIVITY LOG ============
router.get('/activity', superAdminAuth, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('name email createdAt');
    const recentLogins = await User.find({ lastLogin: { $exists: true } }).sort({ lastLogin: -1 }).limit(10).select('name email lastLogin');
    const recentTransactions = await Transaction.find().sort({ createdAt: -1 }).limit(10).select('type category amount memberName createdAt');

    res.json({
      success: true,
      activity: {
        recentSignups: recentUsers,
        recentLogins: recentLogins,
        recentTransactions: recentTransactions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get activity.' });
  }
});

module.exports = router;

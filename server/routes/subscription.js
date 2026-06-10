const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const Family = require('../models/Family');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { sendPaymentSuccessEmail, sendPaymentFailedEmail } = require('../utils/email');

// ============ GET AVAILABLE PLANS ============
router.get('/plans', (req, res) => {
  const plans = Subscription.PLANS;
  res.json({
    success: true,
    plans: Object.entries(plans).map(([key, plan]) => ({
      id: key,
      ...plan
    }))
  });
});

// ============ GET CURRENT SUBSCRIPTION ============
router.get('/current', authenticate, async (req, res) => {
  try {
    let subscription = await Subscription.findOne({ familyId: req.familyId });

    // If no subscription exists, create free plan
    if (!subscription) {
      subscription = await Subscription.create({
        familyId: req.familyId,
        plan: 'free',
        status: 'active',
        maxMembers: 3,
        maxTransactionsPerMonth: 50,
        billingCycle: 'free'
      });
    }

    res.json({
      success: true,
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        maxMembers: subscription.maxMembers,
        maxTransactionsPerMonth: subscription.maxTransactionsPerMonth,
        features: subscription.features,
        billingCycle: subscription.billingCycle,
        nextBillingDate: subscription.nextBillingDate,
        referralCode: subscription.referralCode,
        isValid: subscription.isValid()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get subscription.' });
  }
});

// ============ UPGRADE PLAN ============
router.post('/upgrade', authenticate, async (req, res) => {
  try {
    const { plan, billingCycle, paymentMethod, transactionId, couponCode } = req.body;

    if (!plan || !['basic', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan selected.' });
    }

    const planDetails = Subscription.PLANS[plan];
    if (!planDetails) {
      return res.status(400).json({ success: false, message: 'Plan not found.' });
    }

    let subscription = await Subscription.findOne({ familyId: req.familyId });
    if (!subscription) {
      subscription = new Subscription({ familyId: req.familyId });
    }

    // Calculate price
    const cycle = billingCycle || 'monthly';
    let price = cycle === 'yearly' ? planDetails.priceYearly : planDetails.priceMonthly;

    // Apply coupon discount
    let discount = 0;
    if (couponCode) {
      // Simple coupon system - can be extended
      const validCoupons = {
        'GROMO50': 50,
        'WELCOME20': 20,
        'FAMILY30': 30,
        'LAUNCH100': 100 // Free for launch
      };
      if (validCoupons[couponCode.toUpperCase()]) {
        discount = validCoupons[couponCode.toUpperCase()];
        price = Math.max(0, price - (price * discount / 100));
      }
    }

    // Update subscription
    subscription.plan = plan;
    subscription.status = 'active';
    subscription.maxMembers = planDetails.maxMembers;
    subscription.maxTransactionsPerMonth = planDetails.maxTransactionsPerMonth;
    subscription.features = planDetails.features;
    subscription.priceMonthly = planDetails.priceMonthly;
    subscription.priceYearly = planDetails.priceYearly;
    subscription.billingCycle = cycle;
    subscription.lastPaymentDate = new Date();
    subscription.couponCode = couponCode || undefined;
    subscription.discountPercent = discount;

    // Set next billing date
    if (cycle === 'monthly') {
      subscription.nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    } else if (cycle === 'yearly') {
      subscription.nextBillingDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    }

    // Record payment
    subscription.paymentHistory.push({
      amount: price,
      date: new Date(),
      method: paymentMethod || 'upi',
      transactionId: transactionId || `TXN_${Date.now()}`,
      status: 'success'
    });

    // Update family max members
    await Family.findByIdAndUpdate(req.familyId, { maxMembers: planDetails.maxMembers });

    // Generate referral code if not exists
    if (!subscription.referralCode) {
      subscription.generateReferralCode();
    }

    await subscription.save();

    res.json({
      success: true,
      message: `Upgraded to ${planDetails.name} plan successfully!`,
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        maxMembers: subscription.maxMembers,
        features: subscription.features,
        nextBillingDate: subscription.nextBillingDate,
        referralCode: subscription.referralCode,
        amountPaid: price
      }
    });
  } catch (error) {
    console.error('Upgrade error:', error);
    res.status(500).json({ success: false, message: 'Failed to upgrade plan.' });
  }
});

// ============ START FREE TRIAL (7 days Pro) ============
router.post('/start-trial', authenticate, async (req, res) => {
  try {
    let subscription = await Subscription.findOne({ familyId: req.familyId });
    
    if (!subscription) {
      subscription = new Subscription({ familyId: req.familyId, plan: 'free', status: 'active' });
    }

    // Check if trial already used
    if (subscription.trialStartDate) {
      return res.status(400).json({ success: false, message: 'Free trial already used for this family.' });
    }

    // Activate 7-day Pro trial
    const trialDays = 7;
    const planDetails = Subscription.PLANS['pro'];

    subscription.plan = 'pro';
    subscription.status = 'trial';
    subscription.trialStartDate = new Date();
    subscription.trialEndDate = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    subscription.maxMembers = planDetails.maxMembers;
    subscription.maxTransactionsPerMonth = planDetails.maxTransactionsPerMonth;
    subscription.features = planDetails.features;
    subscription.billingCycle = 'free';

    await Family.findByIdAndUpdate(req.familyId, { maxMembers: planDetails.maxMembers });
    if (!subscription.referralCode) subscription.generateReferralCode();
    await subscription.save();

    res.json({
      success: true,
      message: `🎉 ${trialDays}-day Pro trial activated! Enjoy all premium features.`,
      subscription: {
        plan: 'pro',
        status: 'trial',
        trialEndDate: subscription.trialEndDate,
        trialDaysRemaining: trialDays,
        features: subscription.features,
        maxMembers: subscription.maxMembers
      }
    });
  } catch (error) {
    console.error('Start trial error:', error);
    res.status(500).json({ success: false, message: 'Failed to start trial.' });
  }
});

// ============ CANCEL SUBSCRIPTION ============
router.post('/cancel', authenticate, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ familyId: req.familyId });
    if (!subscription || subscription.plan === 'free') {
      return res.json({ success: true, message: 'You are on the free plan.' });
    }

    subscription.status = 'cancelled';
    // Keep features until billing period ends
    await subscription.save();

    res.json({
      success: true,
      message: `Subscription cancelled. Features remain active until ${subscription.nextBillingDate?.toLocaleDateString() || 'end of period'}.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to cancel.' });
  }
});

// ============ APPLY REFERRAL CODE ============
router.post('/referral', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Referral code required.' });

    const referrerSub = await Subscription.findOne({ referralCode: code.toUpperCase() });
    if (!referrerSub) {
      return res.status(404).json({ success: false, message: 'Invalid referral code.' });
    }
    if (referrerSub.familyId.toString() === req.familyId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot use your own family\'s referral code.' });
    }

    let subscription = await Subscription.findOne({ familyId: req.familyId });
    if (!subscription) {
      subscription = new Subscription({ familyId: req.familyId, plan: 'free', status: 'active' });
    }

    if (subscription.referredBy) {
      return res.status(400).json({ success: false, message: 'Referral already applied to your account.' });
    }

    subscription.referredBy = referrerSub.familyId;
    await subscription.save();

    res.json({
      success: true,
      message: 'Referral applied! You get 20% off your first upgrade.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to apply referral.' });
  }
});

// ============ GET REFERRAL DASHBOARD ============
router.get('/referral', authenticate, async (req, res) => {
  try {
    let subscription = await Subscription.findOne({ familyId: req.familyId });
    
    if (!subscription) {
      subscription = await Subscription.create({
        familyId: req.familyId, plan: 'free', status: 'active'
      });
    }

    // Generate referral code if not exists
    if (!subscription.referralCode) {
      subscription.generateReferralCode();
      await subscription.save();
    }

    // Count referrals - only OTHER families who signed up via this referral code
    const referredSubs = await Subscription.find({ 
      referredBy: req.familyId,
      familyId: { $ne: req.familyId }
    }).select('familyId plan status createdAt');

    // Get names of referred families
    const User = require('../models/User');
    const referredList = [];
    for (const sub of referredSubs) {
      const admin = await User.findOne({ familyId: sub.familyId, role: 'admin' }).select('name email createdAt');
      if (admin) {
        referredList.push({
          name: admin.name,
          email: admin.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email
          plan: sub.plan,
          status: sub.status,
          joinedAt: admin.createdAt
        });
      }
    }

    const referralCount = referredSubs.length;
    const paidReferrals = referredSubs.filter(s => s.plan !== 'free' && ['active', 'trial'].includes(s.status)).length;

    // Calculate earnings
    const earningsPerReferral = 50;
    const totalEarnings = paidReferrals * earningsPerReferral;
    const withdrawnAmount = subscription.withdrawnAmount || 0;
    const availableBalance = totalEarnings - withdrawnAmount;

    const referralLink = `${process.env.FRONTEND_URL || 'https://gromofinance.com'}?ref=${subscription.referralCode}`;

    res.json({
      success: true,
      referral: {
        code: subscription.referralCode,
        link: referralLink,
        totalReferrals: referralCount,
        paidReferrals: paidReferrals,
        earningsPerReferral: earningsPerReferral,
        totalEarnings: totalEarnings,
        withdrawnAmount: withdrawnAmount,
        availableBalance: availableBalance,
        minWithdrawal: 200,
        referredBy: subscription.referredBy ? true : false,
        discountForReferred: '20% off first payment',
        referredUsers: referredList,
        withdrawalHistory: subscription.withdrawalHistory || [],
        note: 'Earn ₹50 for every NEW family that upgrades using your referral code. Family members joining via invite link do NOT count.'
      }
    });
  } catch (error) {
    console.error('Referral dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to get referral info.' });
  }
});

// ============ WITHDRAW / USE REFERRAL EARNINGS ============
router.post('/withdraw', authenticate, async (req, res) => {
  try {
    const { amount, method, upiId, bankAccount, ifsc, accountName } = req.body;

    let subscription = await Subscription.findOne({ familyId: req.familyId });
    if (!subscription) {
      return res.status(400).json({ success: false, message: 'No subscription found.' });
    }

    // Calculate available balance
    const paidReferrals = await Subscription.countDocuments({ 
      referredBy: req.familyId,
      familyId: { $ne: req.familyId },
      plan: { $ne: 'free' },
      status: { $in: ['active', 'trial'] }
    });
    const totalEarnings = paidReferrals * 50;
    const withdrawnAmount = subscription.withdrawnAmount || 0;
    const availableBalance = totalEarnings - withdrawnAmount;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid amount.' });
    }
    if (amount > availableBalance) {
      return res.status(400).json({ success: false, message: `Insufficient balance. Available: ₹${availableBalance}` });
    }

    const withdrawMethod = method || 'upi';
    if (!subscription.withdrawalHistory) subscription.withdrawalHistory = [];

    // ===== OPTION 1: Use as subscription credit (adjust against monthly plan) =====
    if (withdrawMethod === 'subscription') {
      subscription.subscriptionCredit = (subscription.subscriptionCredit || 0) + amount;
      subscription.withdrawnAmount = (subscription.withdrawnAmount || 0) + amount;
      subscription.withdrawalHistory.push({
        amount, date: new Date(), status: 'completed', paymentMethod: 'subscription',
        paymentDetails: { type: 'Subscription credit' }, requestId: `WD_SUB_${Date.now()}`,
        processedDate: new Date(), note: `₹${amount} added as subscription credit`
      });
      await subscription.save();
      return res.json({
        success: true,
        message: `₹${amount} added as subscription credit! Will auto-adjust in your next payment.`,
        withdrawal: { amount, method: 'subscription', status: 'completed', subscriptionCredit: subscription.subscriptionCredit, remainingBalance: availableBalance - amount }
      });
    }

    // ===== OPTION 2: Convert to Pro days (extend subscription free) =====
    if (withdrawMethod === 'extend') {
      const daysToAdd = Math.floor((amount / 199) * 30); // ₹199 = 30 days Pro
      if (daysToAdd < 1) {
        return res.status(400).json({ success: false, message: 'Need at least ₹7 for 1 day Pro extension.' });
      }
      const planDetails = Subscription.PLANS['pro'];
      const currentEnd = (subscription.nextBillingDate && subscription.nextBillingDate > new Date()) ? subscription.nextBillingDate : new Date();
      const newEnd = new Date(currentEnd.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

      subscription.plan = 'pro';
      subscription.status = 'active';
      subscription.maxMembers = planDetails.maxMembers;
      subscription.maxTransactionsPerMonth = planDetails.maxTransactionsPerMonth;
      subscription.features = planDetails.features;
      subscription.nextBillingDate = newEnd;
      subscription.withdrawnAmount = (subscription.withdrawnAmount || 0) + amount;
      subscription.withdrawalHistory.push({
        amount, date: new Date(), status: 'completed', paymentMethod: 'extend',
        paymentDetails: { daysAdded: daysToAdd, newExpiry: newEnd }, requestId: `WD_EXT_${Date.now()}`,
        processedDate: new Date(), note: `Converted to ${daysToAdd} days Pro`
      });
      await subscription.save();
      await Family.findByIdAndUpdate(req.familyId, { maxMembers: planDetails.maxMembers });
      return res.json({
        success: true,
        message: `🎉 ₹${amount} converted to ${daysToAdd} days Pro! Active until ${newEnd.toLocaleDateString('en-IN')}.`,
        withdrawal: { amount, method: 'extend', status: 'completed', daysAdded: daysToAdd, proExpiry: newEnd, remainingBalance: availableBalance - amount }
      });
    }

    // ===== OPTION 3: Cash withdrawal to UPI (min ₹200) =====
    if (amount < 200) {
      return res.status(400).json({ success: false, message: 'Min ₹200 for UPI withdrawal. Try "Use for Pro" option instead!' });
    }
    if (!upiId && !bankAccount) {
      return res.status(400).json({ success: false, message: 'Enter your UPI ID.' });
    }
    subscription.withdrawnAmount = (subscription.withdrawnAmount || 0) + amount;
    subscription.withdrawalHistory.push({
      amount, date: new Date(), status: 'pending', paymentMethod: upiId ? 'upi' : 'bank',
      paymentDetails: upiId ? { upiId } : { bankAccount, ifsc, accountName },
      requestId: `WD_${Date.now()}`
    });
    await subscription.save();
    res.json({
      success: true,
      message: `₹${amount} withdrawal requested! Payment to UPI within 3-5 business days.`,
      withdrawal: { amount, method: 'upi', status: 'pending', remainingBalance: availableBalance - amount }
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ success: false, message: 'Failed to process.' });
  }
});

// ============ CASHFREE: CREATE ORDER ============
router.post('/create-order', authenticate, async (req, res) => {
  try {
    const { plan, billingCycle, couponCode } = req.body;

    if (!plan || !['basic', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan.' });
    }

    const planDetails = Subscription.PLANS[plan];
    const cycle = billingCycle || 'monthly';
    let amount = cycle === 'yearly' ? planDetails.priceYearly : planDetails.priceMonthly;
    let discount = 0;
    let appliedCoupon = '';

    // Apply coupon code discount
    if (couponCode) {
      const validCoupons = {
        'GROMO50': 50,
        'WELCOME20': 20,
        'FAMILY30': 30,
        'LAUNCH100': 100
      };
      const couponDiscount = validCoupons[couponCode.toUpperCase()];
      if (couponDiscount) {
        discount = couponDiscount;
        amount = Math.max(0, Math.round(amount - (amount * discount / 100)));
        appliedCoupon = couponCode.toUpperCase();
      }
    }

    // Check for referral discount
    const subscription = await Subscription.findOne({ familyId: req.familyId });
    if (subscription && subscription.referredBy && subscription.paymentHistory.length === 0) {
      amount = Math.round(amount * 0.8); // 20% off first payment for referred users
    }

    // If amount is 0 (100% coupon like LAUNCH100), activate plan directly without payment
    if (amount <= 0) {
      let sub = subscription || new Subscription({ familyId: req.familyId });
      sub.plan = plan;
      sub.status = 'active';
      sub.maxMembers = planDetails.maxMembers;
      sub.maxTransactionsPerMonth = planDetails.maxTransactionsPerMonth;
      sub.features = planDetails.features;
      sub.priceMonthly = planDetails.priceMonthly;
      sub.priceYearly = planDetails.priceYearly;
      sub.billingCycle = cycle;
      sub.lastPaymentDate = new Date();
      sub.couponCode = appliedCoupon;
      sub.discountPercent = discount;
      if (cycle === 'monthly') {
        sub.nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      } else {
        sub.nextBillingDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      }
      sub.paymentHistory.push({ amount: 0, date: new Date(), method: 'upi', transactionId: 'COUPON_' + appliedCoupon + '_' + Date.now(), status: 'success' });
      await Family.findByIdAndUpdate(req.familyId, { maxMembers: planDetails.maxMembers });
      if (!sub.referralCode) sub.generateReferralCode();
      await sub.save();

      return res.json({
        success: true,
        freePlan: true,
        message: `🎉 Coupon ${appliedCoupon} applied! ${planDetails.name} plan activated for FREE!`,
        subscription: { plan: sub.plan, status: 'active', maxMembers: sub.maxMembers, nextBillingDate: sub.nextBillingDate }
      });
    }

    const orderId = `order_${req.familyId.toString().slice(-8)}_${Date.now()}`;
    const user = req.user;

    // Cashfree API - Create Order
    const cashfreeHost = process.env.CASHFREE_ENV === 'production' 
      ? 'https://api.cashfree.com' 
      : 'https://sandbox.cashfree.com';

    const fetch = require('node-fetch') || globalThis.fetch;
    const response = await fetch(`${cashfreeHost}/pg/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2025-01-01',
        'x-client-id': process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: 'INR',
        customer_details: {
          customer_id: req.familyId.toString(),
          customer_name: user.name,
          customer_email: user.email,
          customer_phone: user.phone
        },
        order_meta: {
          return_url: `${process.env.FRONTEND_URL || 'https://gromofinance.com'}?payment=success&order_id=${orderId}`,
          notify_url: `${process.env.FRONTEND_URL || 'https://gromofinance.com'}/api/subscription/webhook`
        },
        order_note: `${planDetails.name} Plan - ${cycle}`
      })
    });

    const orderData = await response.json();

    if (!response.ok || !orderData.payment_session_id) {
      console.error('Cashfree create order error:', orderData);
      return res.status(500).json({ success: false, message: 'Failed to create payment order.' });
    }

    res.json({
      success: true,
      order: {
        orderId: orderData.order_id,
        paymentSessionId: orderData.payment_session_id,
        amount: amount,
        originalAmount: cycle === 'yearly' ? planDetails.priceYearly : planDetails.priceMonthly,
        discount: discount,
        couponApplied: appliedCoupon,
        currency: 'INR',
        plan: plan,
        planName: planDetails.name,
        billingCycle: cycle
      },
      cashfreeEnv: process.env.CASHFREE_ENV || 'sandbox'
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: 'Failed to create payment order.' });
  }
});

// ============ CASHFREE: VERIFY PAYMENT ============
router.post('/verify-payment', authenticate, async (req, res) => {
  try {
    const { orderId, plan, billingCycle } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID required.' });
    }

    // Verify order status with Cashfree
    const cashfreeHost = process.env.CASHFREE_ENV === 'production' 
      ? 'https://api.cashfree.com' 
      : 'https://sandbox.cashfree.com';

    const fetch = require('node-fetch') || globalThis.fetch;
    const response = await fetch(`${cashfreeHost}/pg/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'x-api-version': '2025-01-01',
        'x-client-id': process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY
      }
    });

    const orderData = await response.json();

    if (!response.ok || orderData.order_status !== 'PAID') {
      return res.status(400).json({ 
        success: false, 
        message: `Payment not completed. Status: ${orderData.order_status || 'unknown'}` 
      });
    }

    // Payment verified - activate plan
    const planDetails = Subscription.PLANS[plan];
    const cycle = billingCycle || 'monthly';
    const amount = cycle === 'yearly' ? planDetails.priceYearly : planDetails.priceMonthly;

    let subscription = await Subscription.findOne({ familyId: req.familyId });
    if (!subscription) {
      subscription = new Subscription({ familyId: req.familyId });
    }

    subscription.plan = plan;
    subscription.status = 'active';
    subscription.maxMembers = planDetails.maxMembers;
    subscription.maxTransactionsPerMonth = planDetails.maxTransactionsPerMonth;
    subscription.features = planDetails.features;
    subscription.priceMonthly = planDetails.priceMonthly;
    subscription.priceYearly = planDetails.priceYearly;
    subscription.billingCycle = cycle;
    subscription.lastPaymentDate = new Date();

    if (cycle === 'monthly') {
      subscription.nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    } else {
      subscription.nextBillingDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    }

    subscription.paymentHistory.push({
      amount: amount,
      date: new Date(),
      method: 'upi',
      transactionId: orderId,
      status: 'success'
    });

    await Family.findByIdAndUpdate(req.familyId, { maxMembers: planDetails.maxMembers });
    if (!subscription.referralCode) subscription.generateReferralCode();
    await subscription.save();

    res.json({
      success: true,
      message: `Payment successful! ${planDetails.name} plan activated.`,
      subscription: {
        plan: subscription.plan,
        status: 'active',
        maxMembers: subscription.maxMembers,
        features: subscription.features,
        nextBillingDate: subscription.nextBillingDate
      }
    });

    // Send payment success email with receipt + referral code (non-blocking)
    const user = await User.findById(req.userId);
    if (user) {
      sendPaymentSuccessEmail(user, {
        plan: planDetails.name,
        amount: amount,
        transactionId: orderId,
        billingCycle: cycle,
        nextBillingDate: subscription.nextBillingDate,
        referralCode: subscription.referralCode || ''
      }).catch(err => console.log('Payment email error:', err));
    }
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ success: false, message: 'Payment verification failed.' });
  }
});

// ============ CASHFREE: WEBHOOK (auto-confirm payments) ============
router.post('/webhook', async (req, res) => {
  try {
    // Cashfree sends payment updates here
    const { data } = req.body;
    if (data && data.order && data.order.order_id) {
      console.log('Cashfree webhook received for order:', data.order.order_id, 'Status:', data.order.order_status);
    }
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(200).json({ success: true }); // Always return 200 to webhooks
  }
});

// ============ GET PAYMENT HISTORY ============
router.get('/payments', authenticate, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ familyId: req.familyId });
    if (!subscription) {
      return res.json({ success: true, payments: [] });
    }

    res.json({
      success: true,
      payments: subscription.paymentHistory.sort((a, b) => b.date - a.date)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get payments.' });
  }
});

// ============ ADMIN: MANUALLY ACTIVATE PLAN FOR FAMILY ============
router.post('/admin-activate', async (req, res) => {
  try {
    const { familyId, plan, months, adminKey } = req.body;

    // Simple admin key check
    if (adminKey !== (process.env.SUPER_ADMIN_PASSWORD || 'admin123')) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    const planDetails = Subscription.PLANS[plan];
    if (!planDetails) {
      return res.status(400).json({ success: false, message: 'Invalid plan.' });
    }

    let subscription = await Subscription.findOne({ familyId });
    if (!subscription) {
      subscription = new Subscription({ familyId });
    }

    subscription.plan = plan;
    subscription.status = 'active';
    subscription.maxMembers = planDetails.maxMembers;
    subscription.maxTransactionsPerMonth = planDetails.maxTransactionsPerMonth;
    subscription.features = planDetails.features;
    subscription.billingCycle = 'monthly';
    subscription.lastPaymentDate = new Date();
    subscription.nextBillingDate = new Date(Date.now() + (months || 1) * 30 * 24 * 60 * 60 * 1000);

    await Family.findByIdAndUpdate(familyId, { maxMembers: planDetails.maxMembers });
    if (!subscription.referralCode) subscription.generateReferralCode();
    await subscription.save();

    res.json({ success: true, message: `Plan ${plan} activated for ${months || 1} month(s).` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to activate.' });
  }
});

module.exports = router;

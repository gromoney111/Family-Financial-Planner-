const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const Family = require('../models/Family');
const { authenticate } = require('../middleware/auth');

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
      return res.status(400).json({ success: false, message: 'Cannot use your own referral code.' });
    }

    let subscription = await Subscription.findOne({ familyId: req.familyId });
    if (!subscription) {
      subscription = new Subscription({ familyId: req.familyId, plan: 'free', status: 'active' });
    }

    if (subscription.referredBy) {
      return res.status(400).json({ success: false, message: 'Referral already applied.' });
    }

    subscription.referredBy = referrerSub.familyId;
    await subscription.save();

    res.json({
      success: true,
      message: 'Referral code applied! You will get 20% off on your first upgrade.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to apply referral.' });
  }
});

// ============ RAZORPAY: CREATE ORDER ============
router.post('/create-order', authenticate, async (req, res) => {
  try {
    const { plan, billingCycle } = req.body;

    if (!plan || !['basic', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan.' });
    }

    const planDetails = Subscription.PLANS[plan];
    const cycle = billingCycle || 'monthly';
    let amount = cycle === 'yearly' ? planDetails.priceYearly : planDetails.priceMonthly;

    // Check for referral discount
    const subscription = await Subscription.findOne({ familyId: req.familyId });
    if (subscription && subscription.referredBy && subscription.paymentHistory.length === 0) {
      amount = Math.round(amount * 0.8); // 20% off first payment for referred users
    }

    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const order = await razorpay.orders.create({
      amount: amount * 100, // Razorpay expects paise
      currency: 'INR',
      receipt: `order_${req.familyId}_${Date.now()}`,
      notes: {
        familyId: req.familyId.toString(),
        plan: plan,
        billingCycle: cycle
      }
    });

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        plan: plan,
        planName: planDetails.name,
        billingCycle: cycle
      },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: 'Failed to create payment order.' });
  }
});

// ============ RAZORPAY: VERIFY PAYMENT ============
router.post('/verify-payment', authenticate, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, billingCycle } = req.body;

    // Verify signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed.' });
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
      transactionId: razorpay_payment_id,
      status: 'success'
    });

    await Family.findByIdAndUpdate(req.familyId, { maxMembers: planDetails.maxMembers });
    if (!subscription.referralCode) subscription.generateReferralCode();
    await subscription.save();

    res.json({
      success: true,
      message: `🎉 Payment successful! ${planDetails.name} plan activated.`,
      subscription: {
        plan: subscription.plan,
        status: 'active',
        maxMembers: subscription.maxMembers,
        features: subscription.features,
        nextBillingDate: subscription.nextBillingDate
      }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ success: false, message: 'Payment verification failed.' });
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

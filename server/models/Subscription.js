const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family',
    required: true,
    index: true
  },
  plan: {
    type: String,
    enum: ['free', 'basic', 'pro', 'enterprise'],
    default: 'free'
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'trial'],
    default: 'active'
  },
  // Plan Features
  maxMembers: {
    type: Number,
    default: 3 // Free plan: 3 members
  },
  maxTransactionsPerMonth: {
    type: Number,
    default: 50 // Free plan: 50 transactions/month
  },
  features: {
    pdfExport: { type: Boolean, default: true },
    csvExport: { type: Boolean, default: false },
    loanTracker: { type: Boolean, default: false },
    investmentTracker: { type: Boolean, default: false },
    budgetAlerts: { type: Boolean, default: true },
    emailReports: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    customCategories: { type: Boolean, default: false },
    multiCurrency: { type: Boolean, default: false }
  },
  // Billing
  priceMonthly: {
    type: Number,
    default: 0 // in INR
  },
  priceYearly: {
    type: Number,
    default: 0
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly', 'lifetime', 'free'],
    default: 'free'
  },
  // Payment tracking
  lastPaymentDate: Date,
  nextBillingDate: Date,
  paymentHistory: [{
    amount: Number,
    date: { type: Date, default: Date.now },
    method: { type: String, enum: ['upi', 'card', 'netbanking', 'wallet', 'manual'], default: 'upi' },
    transactionId: String,
    status: { type: String, enum: ['success', 'failed', 'pending'], default: 'success' }
  }],
  // Trial
  trialStartDate: Date,
  trialEndDate: Date,
  // Coupon/Discount
  couponCode: String,
  discountPercent: { type: Number, default: 0 },
  // Referral
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family'
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  // Withdrawal tracking
  withdrawnAmount: {
    type: Number,
    default: 0
  },
  subscriptionCredit: {
    type: Number,
    default: 0
  },
  withdrawalHistory: [{
    amount: Number,
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'completed', 'rejected'], default: 'pending' },
    paymentMethod: { type: String, enum: ['upi', 'bank'], default: 'upi' },
    paymentDetails: mongoose.Schema.Types.Mixed,
    requestId: String,
    processedDate: Date,
    note: String
  }]
}, {
  timestamps: true
});

// Generate referral code
subscriptionSchema.methods.generateReferralCode = function() {
  this.referralCode = 'GROMO' + this.familyId.toString().slice(-6).toUpperCase();
  return this.referralCode;
};

// Check if subscription is active (includes trial)
subscriptionSchema.methods.isValid = function() {
  if (this.plan === 'free') return true;
  if (this.status === 'trial') {
    return this.trialEndDate && new Date() <= this.trialEndDate;
  }
  if (this.status !== 'active') return false;
  if (this.nextBillingDate && new Date() > this.nextBillingDate) return false;
  return true;
};

// Check if user is on active trial
subscriptionSchema.methods.isOnTrial = function() {
  return this.status === 'trial' && this.trialEndDate && new Date() <= this.trialEndDate;
};

// Get days remaining in trial
subscriptionSchema.methods.trialDaysRemaining = function() {
  if (!this.trialEndDate) return 0;
  const diff = this.trialEndDate - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

// Check if trial has been used
subscriptionSchema.methods.hasUsedTrial = function() {
  return !!this.trialStartDate;
};

// Static method: Plan definitions
subscriptionSchema.statics.PLANS = {
  free: {
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    maxMembers: 3,
    maxTransactionsPerMonth: 50,
    features: {
      pdfExport: true,
      csvExport: false,
      loanTracker: false,
      investmentTracker: false,
      budgetAlerts: true,
      emailReports: false,
      prioritySupport: false,
      customCategories: false,
      multiCurrency: false
    }
  },
  basic: {
    name: 'Basic',
    priceMonthly: 99,
    priceYearly: 999,
    maxMembers: 4,
    maxTransactionsPerMonth: 200,
    features: {
      pdfExport: true,
      csvExport: true,
      loanTracker: true,
      investmentTracker: false,
      budgetAlerts: true,
      emailReports: false,
      prioritySupport: false,
      customCategories: true,
      multiCurrency: false
    }
  },
  pro: {
    name: 'Pro',
    priceMonthly: 199,
    priceYearly: 1999,
    maxMembers: 6,
    maxTransactionsPerMonth: -1, // unlimited
    features: {
      pdfExport: true,
      csvExport: true,
      loanTracker: true,
      investmentTracker: true,
      budgetAlerts: true,
      emailReports: true,
      prioritySupport: true,
      customCategories: true,
      multiCurrency: false
    }
  },
  enterprise: {
    name: 'Enterprise',
    priceMonthly: 499,
    priceYearly: 4999,
    maxMembers: 10,
    maxTransactionsPerMonth: -1, // unlimited
    features: {
      pdfExport: true,
      csvExport: true,
      loanTracker: true,
      investmentTracker: true,
      budgetAlerts: true,
      emailReports: true,
      prioritySupport: true,
      customCategories: true,
      multiCurrency: true
    }
  }
};

module.exports = mongoose.model('Subscription', subscriptionSchema);

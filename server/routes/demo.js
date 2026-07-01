const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Family = require('../models/Family');
const Transaction = require('../models/Transaction');
const Loan = require('../models/Loan');
const Investment = require('../models/Investment');
const Insurance = require('../models/Insurance');
const Balance = require('../models/Balance');
const Budget = require('../models/Budget');
const { generateToken } = require('../middleware/auth');
const { DEMO_FAMILY, DEMO_PASSWORD, DEMO_FAMILY_CODE } = require('../seeds/demoData');

let lastResetTime = null;
const RESET_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours


// Helper: generate random date in past N months
function randomDate(monthsBack) {
  const now = new Date();
  const past = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
}

// Helper: random amount in range
function randAmount(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

// Helper: pick random from array
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }


// ============ GENERATE SEED DATA ============
async function generateDemoData() {
  // Clear existing demo data
  const existingFamily = await Family.findOne({ familyCode: DEMO_FAMILY_CODE });
  if (existingFamily) {
    const fid = existingFamily._id;
    await Promise.all([
      User.deleteMany({ familyId: fid }),
      Transaction.deleteMany({ familyId: fid }),
      Loan.deleteMany({ familyId: fid }),
      Investment.deleteMany({ familyId: fid }),
      Insurance.deleteMany({ familyId: fid }),
      Balance.deleteMany({ familyId: fid }),
      Budget.deleteMany({ familyId: fid }),
      Family.deleteOne({ _id: fid })
    ]);
  }

  // Create family
  const family = await Family.create({
    familyCode: DEMO_FAMILY_CODE,
    familyName: 'Sharma Family (Demo)',
    adminId: new mongoose.Types.ObjectId(),
    members: [],
    maxMembers: 10,
    settings: { currency: '₹', locale: 'en-IN' }
  });

  const hashedPw = await bcrypt.hash(DEMO_PASSWORD, 12);


  // Create admin user
  const admin = await User.create({
    name: DEMO_FAMILY.admin.name,
    email: DEMO_FAMILY.admin.email,
    phone: DEMO_FAMILY.admin.phone,
    password: hashedPw,
    role: 'admin',
    relation: 'Self',
    familyId: family._id,
    isActive: true,
    isEmailVerified: true
  });
  // bypass pre-save hook since we pre-hashed
  await User.updateOne({ _id: admin._id }, { $set: { password: hashedPw } });

  family.adminId = admin._id;
  family.members.push(admin._id);

  // Create members
  const memberDocs = [];
  for (const m of DEMO_FAMILY.members) {
    const member = await User.create({
      name: m.name, email: m.email, phone: m.phone,
      password: hashedPw, role: m.role, relation: m.relation,
      familyId: family._id, isActive: true, isEmailVerified: true
    });
    await User.updateOne({ _id: member._id }, { $set: { password: hashedPw } });
    family.members.push(member._id);
    memberDocs.push(member);
  }
  await family.save();

  const allMembers = [admin, ...memberDocs];
  const fid = family._id;


  // ---- TRANSACTIONS (500+) ----
  const incomeCategories = ['Salary', 'Freelance', 'Business', 'Rental Income', 'Interest', 'Dividends', 'Bonus', 'Gift'];
  const expenseCategories = ['Groceries', 'Rent', 'EMI', 'Electricity', 'Water', 'Internet', 'Mobile', 'Fuel', 'Shopping', 'Medical', 'Education', 'Insurance Premium', 'Dining Out', 'Entertainment', 'Travel', 'Maintenance', 'Clothing', 'Charity', 'Household', 'Personal Care'];
  const paymentMethods = ['Cash', 'Bank Transfer', 'Credit Card', 'UPI', 'Wallet'];
  const banks = ['SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Bank'];

  const transactions = [];
  // Generate 520 transactions over 12 months
  for (let i = 0; i < 520; i++) {
    const member = pick(allMembers);
    const isIncome = Math.random() < 0.3;
    const type = isIncome ? 'income' : (Math.random() < 0.92 ? 'expense' : pick(['borrow', 'lend', 'transfer']));
    let category, amount;
    if (type === 'income') {
      category = pick(incomeCategories);
      amount = category === 'Salary' ? randAmount(35000, 150000) : randAmount(1000, 50000);
    } else if (type === 'expense') {
      category = pick(expenseCategories);
      amount = category === 'Rent' ? randAmount(12000, 35000) :
               category === 'EMI' ? randAmount(5000, 45000) :
               category === 'Groceries' ? randAmount(2000, 12000) :
               randAmount(200, 15000);
    } else {
      category = type === 'transfer' ? 'Family Transfer' : 'Personal';
      amount = randAmount(1000, 30000);
    }


    transactions.push({
      familyId: fid,
      userId: member._id,
      memberName: member.name,
      type,
      category,
      amount,
      description: `${category} - ${member.name.split(' ')[0]}`,
      date: randomDate(12),
      paymentMethod: pick(paymentMethods),
      bankName: pick(banks),
      borrowerLenderName: (type === 'borrow' || type === 'lend') ? pick(['Amit', 'Vikram', 'Neha', 'Sanjay']) : '',
      transferTo: type === 'transfer' ? pick(allMembers).name : '',
      transferFrom: type === 'transfer' ? member.name : ''
    });
  }
  await Transaction.insertMany(transactions);


  // ---- LOANS ----
  const loanData = [
    { type: 'Home Loan', lender: 'SBI', principal: 3500000, rate: 8.5, tenure: 240, emi: 30369, emisPaid: 36, memberName: admin.name, emiDueDay: 5 },
    { type: 'Car Loan', lender: 'HDFC Bank', principal: 800000, rate: 9.2, tenure: 60, emi: 16598, emisPaid: 18, memberName: admin.name, emiDueDay: 10 },
    { type: 'Education Loan', lender: 'ICICI Bank', principal: 1200000, rate: 10.5, tenure: 84, emi: 19986, emisPaid: 12, memberName: memberDocs[1].name, emiDueDay: 15 },
    { type: 'Personal Loan', lender: 'Axis Bank', principal: 500000, rate: 12, tenure: 36, emi: 16607, emisPaid: 8, memberName: memberDocs[0].name, emiDueDay: 1 },
    { type: 'Gold Loan', lender: 'Muthoot Finance', principal: 300000, rate: 7.5, tenure: 24, emi: 13506, emisPaid: 6, memberName: memberDocs[3].name, emiDueDay: 20 }
  ];

  const loans = [];
  for (const l of loanData) {
    loans.push({
      familyId: fid,
      userId: admin._id,
      ...l,
      startDate: new Date(2023, 0, 1),
      status: 'active',
      payments: []
    });
  }
  await Loan.insertMany(loans);


  // ---- INVESTMENTS ----
  const investData = [
    { type: 'Mutual Fund', name: 'Axis Bluechip Fund', investedAmount: 500000, currentValue: 620000, memberName: admin.name, monthlyContribution: 10000, paymentDueDay: 5 },
    { type: 'SIP', name: 'HDFC Mid-Cap SIP', investedAmount: 240000, currentValue: 295000, memberName: admin.name, monthlyContribution: 5000, paymentDueDay: 10 },
    { type: 'Fixed Deposit', name: 'SBI FD 7.5%', investedAmount: 1000000, currentValue: 1075000, memberName: memberDocs[0].name, monthlyContribution: 0 },
    { type: 'PPF', name: 'Public Provident Fund', investedAmount: 800000, currentValue: 920000, memberName: admin.name, monthlyContribution: 12500, paymentDueDay: 1 },
    { type: 'NPS', name: 'National Pension Scheme', investedAmount: 600000, currentValue: 710000, memberName: admin.name, monthlyContribution: 5000, paymentDueDay: 15 },
    { type: 'Stocks', name: 'Reliance + TCS + HDFC', investedAmount: 350000, currentValue: 480000, memberName: memberDocs[1].name, monthlyContribution: 0 },
    { type: 'Gold', name: 'Sovereign Gold Bond', investedAmount: 200000, currentValue: 260000, memberName: memberDocs[3].name, monthlyContribution: 0 },
    { type: 'LIC', name: 'LIC Jeevan Anand', investedAmount: 450000, currentValue: 520000, memberName: memberDocs[0].name, monthlyContribution: 3750, paymentDueDay: 20 },
    { type: 'Real Estate', name: 'Plot - Sector 62 Noida', investedAmount: 2500000, currentValue: 3200000, memberName: admin.name, monthlyContribution: 0 },
    { type: 'Bonds', name: 'RBI Floating Rate Bond', investedAmount: 300000, currentValue: 330000, memberName: memberDocs[3].name, monthlyContribution: 0 }
  ];

  const investments = [];
  for (const inv of investData) {
    investments.push({
      familyId: fid,
      userId: admin._id,
      ...inv,
      startDate: new Date(2022, Math.floor(Math.random() * 12), 1),
      maturityDate: inv.type === 'Fixed Deposit' ? new Date(2026, 6, 1) : null,
      expectedReturn: inv.type === 'Stocks' ? 15 : inv.type === 'Gold' ? 8 : 12,
      status: 'active'
    });
  }
  await Investment.insertMany(investments);


  // ---- INSURANCE ----
  const insuranceData = [
    { type: 'Health', provider: 'Star Health', policyName: 'Family Floater 10L', sumInsured: 1000000, premium: 22000, premiumFrequency: 'yearly', memberName: admin.name },
    { type: 'Term Life', provider: 'ICICI Prudential', policyName: 'iProtect Smart', sumInsured: 10000000, premium: 12500, premiumFrequency: 'yearly', memberName: admin.name },
    { type: 'Motor', provider: 'HDFC Ergo', policyName: 'Car Insurance - Swift', sumInsured: 600000, premium: 8500, premiumFrequency: 'yearly', memberName: admin.name },
    { type: 'Health', provider: 'Niva Bupa', policyName: 'Senior Citizen Plan', sumInsured: 500000, premium: 35000, premiumFrequency: 'yearly', memberName: memberDocs[3].name },
    { type: 'Personal Accident', provider: 'Bajaj Allianz', policyName: 'PA Cover 25L', sumInsured: 2500000, premium: 3500, premiumFrequency: 'yearly', memberName: admin.name },
    { type: 'Critical Illness', provider: 'Max Life', policyName: 'Critical Cover', sumInsured: 2000000, premium: 8000, premiumFrequency: 'yearly', memberName: memberDocs[0].name }
  ];

  const insurances = [];
  for (const ins of insuranceData) {
    insurances.push({
      familyId: fid,
      userId: admin._id,
      ...ins,
      policyNumber: 'POL' + Math.random().toString(36).substr(2, 8).toUpperCase(),
      startDate: new Date(2024, 0, 1),
      renewalDate: new Date(2025, 0, 1),
      status: 'active'
    });
  }
  await Insurance.insertMany(insurances);


  // ---- BALANCES ----
  const months = ['2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12', '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06'];
  const verticals = ['SBI Savings', 'HDFC Savings', 'Cash', 'ICICI Credit Card'];
  const balances = [];
  let running = { 'SBI Savings': 185000, 'HDFC Savings': 320000, 'Cash': 25000, 'ICICI Credit Card': -45000 };
  for (const month of months) {
    for (const v of verticals) {
      const opening = running[v];
      const change = randAmount(-30000, 50000);
      const closing = opening + change;
      balances.push({ familyId: fid, vertical: v, month, opening, closing });
      running[v] = closing;
    }
  }
  await Balance.insertMany(balances);

  // ---- BUDGETS ----
  const budgetData = [
    { category: 'Groceries', limit: 15000 },
    { category: 'Dining Out', limit: 8000 },
    { category: 'Shopping', limit: 10000 },
    { category: 'Fuel', limit: 6000 },
    { category: 'Entertainment', limit: 5000 },
    { category: 'Medical', limit: 10000 },
    { category: 'Education', limit: 20000 },
    { category: 'Electricity', limit: 4000 }
  ];
  const budgets = budgetData.map(b => ({ familyId: fid, ...b, month: new Date().toISOString().slice(0, 7) }));
  await Budget.insertMany(budgets);

  lastResetTime = Date.now();
  return { familyId: fid, adminId: admin._id, memberCount: allMembers.length, transactionCount: transactions.length };
}


// ============ DEMO LOGIN (no OTP/verification needed) ============
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const loginEmail = email || DEMO_FAMILY.admin.email;
    const loginPw = password || DEMO_PASSWORD;

    // Auto-reset if needed
    if (!lastResetTime || (Date.now() - lastResetTime > RESET_INTERVAL)) {
      try { await generateDemoData(); } catch (e) { console.log('Demo reset error:', e.message); }
    }

    const user = await User.findOne({ email: loginEmail.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Demo account not found. Try resetting demo.' });
    }

    const isMatch = await bcrypt.compare(loginPw, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid demo credentials.' });
    }

    user.lastLogin = new Date();
    await user.save();

    const family = await Family.findById(user.familyId);
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Welcome to GromoFinance Demo!',
      token,
      user: user.toSafeObject(),
      familyCode: family?.familyCode || '',
      isDemo: true
    });
  } catch (error) {
    console.error('Demo login error:', error);
    res.status(500).json({ success: false, message: 'Demo login failed.' });
  }
});


// ============ RESET DEMO DATA ============
router.post('/reset', async (req, res) => {
  try {
    const result = await generateDemoData();
    res.json({ success: true, message: 'Demo data reset successfully!', ...result });
  } catch (error) {
    console.error('Demo reset error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset demo data.' });
  }
});

// ============ DEMO STATUS ============
router.get('/status', (req, res) => {
  const nextReset = lastResetTime ? new Date(lastResetTime + RESET_INTERVAL) : null;
  res.json({
    success: true,
    isDemo: true,
    lastReset: lastResetTime ? new Date(lastResetTime) : null,
    nextReset,
    credentials: { email: DEMO_FAMILY.admin.email, password: DEMO_PASSWORD },
    members: [DEMO_FAMILY.admin, ...DEMO_FAMILY.members].map(m => ({ name: m.name, email: m.email, role: m.role }))
  });
});

// ============ AI INSIGHTS (simulated for demo) ============
router.get('/ai-insights', async (req, res) => {
  const insights = [
    { type: 'warning', icon: '⚠️', title: 'High Expense Alert', message: 'Shopping expenses increased 35% this month compared to last month. Consider reviewing discretionary spending.' },
    { type: 'success', icon: '📈', title: 'Investment Growth', message: 'Your mutual fund portfolio has grown 24% in the last year. Axis Bluechip Fund is your top performer.' },
    { type: 'info', icon: '💡', title: 'Savings Opportunity', message: 'You could save ₹12,000/month by switching to a lower-rate home loan. Current market rates are 8.25%.' },
    { type: 'warning', icon: '🏦', title: 'EMI Burden', message: 'Total EMI payments are 42% of monthly income. Financial advisors recommend keeping it under 40%.' },
    { type: 'success', icon: '🎯', title: 'Budget Goal Met', message: 'Great job! You stayed within budget for 6 out of 8 categories this month.' },
    { type: 'info', icon: '🔄', title: 'Insurance Renewal', message: 'Star Health Family Floater is due for renewal next month. Compare plans to ensure best coverage.' },
    { type: 'success', icon: '💰', title: 'Net Worth Growth', message: 'Family net worth increased by ₹4.8L in the last 6 months. Real estate appreciation is the biggest contributor.' },
    { type: 'info', icon: '📊', title: 'Tax Saving Tip', message: 'You can save up to ₹46,800 in taxes by maximizing 80C investments. Current utilization: 68%.' }
  ];
  res.json({ success: true, insights });
});


// ============ GOALS TRACKER (simulated for demo) ============
router.get('/goals', (req, res) => {
  const goals = [
    { id: 1, name: 'Emergency Fund', target: 600000, current: 425000, icon: '🛡️', deadline: '2025-12-31', category: 'Safety' },
    { id: 2, name: 'Vacation - Maldives', target: 300000, current: 180000, icon: '✈️', deadline: '2025-09-30', category: 'Lifestyle' },
    { id: 3, name: 'New Car Down Payment', target: 500000, current: 320000, icon: '🚗', deadline: '2026-03-31', category: 'Purchase' },
    { id: 4, name: "Arjun's Education", target: 2000000, current: 950000, icon: '🎓', deadline: '2027-06-30', category: 'Education' },
    { id: 5, name: 'Home Renovation', target: 800000, current: 200000, icon: '🏠', deadline: '2026-06-30', category: 'Home' },
    { id: 6, name: 'Retirement Corpus', target: 50000000, current: 8500000, icon: '🏖️', deadline: '2045-12-31', category: 'Retirement' }
  ];
  res.json({ success: true, goals });
});

// ============ INIT DEMO ON SERVER START ============
router.initDemo = async function() {
  try {
    const existingFamily = await Family.findOne({ familyCode: DEMO_FAMILY_CODE });
    if (!existingFamily) {
      console.log('🎭 Initializing demo data...');
      await generateDemoData();
      console.log('✅ Demo data seeded successfully');
    } else {
      lastResetTime = Date.now();
      console.log('✅ Demo data already exists');
    }
  } catch (err) {
    console.log('⚠️ Demo init skipped:', err.message);
  }
};

module.exports = router;

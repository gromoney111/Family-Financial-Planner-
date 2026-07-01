const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ========== MOCK DEMO API ==========

// Demo credentials
const DEMO_USER = {
  id: 'demo_001',
  name: 'Rajesh Sharma',
  email: 'demo@gromofinance.com',
  phone: '9876543210',
  role: 'admin',
  relation: 'Self',
  familyId: 'family_demo_001',
  profilePicture: '',
  bankAccounts: [
    { bankName: 'SBI', accountNumber: 'XXXX1234', isDefault: true },
    { bankName: 'HDFC Bank', accountNumber: 'XXXX5678', isDefault: false }
  ]
};

const DEMO_MEMBERS = [
  { name: 'Rajesh Sharma', email: 'demo@gromofinance.com', role: 'admin', relation: 'Self' },
  { name: 'Priya Sharma', email: 'priya@demo.com', role: 'member', relation: 'Spouse' },
  { name: 'Arjun Sharma', email: 'arjun@demo.com', role: 'member', relation: 'Son' },
  { name: 'Ananya Sharma', email: 'ananya@demo.com', role: 'member', relation: 'Daughter' },
  { name: 'Suresh Sharma', email: 'suresh@demo.com', role: 'member', relation: 'Father' },
  { name: 'Kamla Sharma', email: 'kamla@demo.com', role: 'member', relation: 'Mother' }
];

// Generate demo transactions
function generateTransactions() {
  const members = ['Rajesh Sharma', 'Priya Sharma', 'Arjun Sharma', 'Ananya Sharma', 'Suresh Sharma', 'Kamla Sharma'];
  const incomeCategories = ['Salary', 'Freelance', 'Business', 'Rental Income', 'Interest', 'Dividends', 'Bonus', 'Gift'];
  const expenseCategories = ['Groceries', 'Rent', 'EMI', 'Electricity', 'Water', 'Internet', 'Mobile', 'Fuel', 'Shopping', 'Medical', 'Education', 'Insurance Premium', 'Dining Out', 'Entertainment', 'Travel', 'Maintenance', 'Clothing', 'Charity', 'Household', 'Personal Care'];
  const paymentMethods = ['Cash', 'Bank Transfer', 'Credit Card', 'UPI', 'Wallet'];
  const banks = ['SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Bank'];
  const txns = [];

  for (let i = 0; i < 520; i++) {
    const member = members[Math.floor(Math.random() * members.length)];
    const isIncome = Math.random() < 0.3;
    const type = isIncome ? 'income' : (Math.random() < 0.92 ? 'expense' : ['borrow', 'lend', 'transfer'][Math.floor(Math.random() * 3)]);
    let category, amount;

    if (type === 'income') {
      category = incomeCategories[Math.floor(Math.random() * incomeCategories.length)];
      amount = category === 'Salary' ? 35000 + Math.round(Math.random() * 115000) : 1000 + Math.round(Math.random() * 49000);
    } else if (type === 'expense') {
      category = expenseCategories[Math.floor(Math.random() * expenseCategories.length)];
      amount = category === 'Rent' ? 12000 + Math.round(Math.random() * 23000) :
               category === 'EMI' ? 5000 + Math.round(Math.random() * 40000) :
               category === 'Groceries' ? 2000 + Math.round(Math.random() * 10000) :
               200 + Math.round(Math.random() * 14800);
    } else {
      category = type === 'transfer' ? 'Family Transfer' : 'Personal';
      amount = 1000 + Math.round(Math.random() * 29000);
    }

    const daysAgo = Math.floor(Math.random() * 365);
    const date = new Date(Date.now() - daysAgo * 86400000);

    txns.push({
      _id: 'txn_' + i,
      memberName: member,
      type, category, amount,
      description: category + ' - ' + member.split(' ')[0],
      date: date.toISOString(),
      paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      bankName: banks[Math.floor(Math.random() * banks.length)]
    });
  }
  return txns.sort((a, b) => new Date(b.date) - new Date(a.date));
}

const DEMO_TRANSACTIONS = generateTransactions();

const DEMO_LOANS = [
  { _id: 'loan_1', type: 'Home Loan', lender: 'SBI', principal: 3500000, rate: 8.5, tenure: 240, emi: 30369, emisPaid: 36, memberName: 'Rajesh Sharma', emiDueDay: 5, status: 'active', startDate: '2023-01-01', payments: [], remainingBalance: 3200000 },
  { _id: 'loan_2', type: 'Car Loan', lender: 'HDFC Bank', principal: 800000, rate: 9.2, tenure: 60, emi: 16598, emisPaid: 18, memberName: 'Rajesh Sharma', emiDueDay: 10, status: 'active', startDate: '2023-01-01', payments: [], remainingBalance: 520000 },
  { _id: 'loan_3', type: 'Education Loan', lender: 'ICICI Bank', principal: 1200000, rate: 10.5, tenure: 84, emi: 19986, emisPaid: 12, memberName: 'Arjun Sharma', emiDueDay: 15, status: 'active', startDate: '2023-06-01', payments: [], remainingBalance: 1020000 },
  { _id: 'loan_4', type: 'Personal Loan', lender: 'Axis Bank', principal: 500000, rate: 12, tenure: 36, emi: 16607, emisPaid: 8, memberName: 'Priya Sharma', emiDueDay: 1, status: 'active', startDate: '2024-01-01', payments: [], remainingBalance: 380000 },
  { _id: 'loan_5', type: 'Gold Loan', lender: 'Muthoot Finance', principal: 300000, rate: 7.5, tenure: 24, emi: 13506, emisPaid: 6, memberName: 'Suresh Sharma', emiDueDay: 20, status: 'active', startDate: '2024-06-01', payments: [], remainingBalance: 220000 }
];

const DEMO_INVESTMENTS = [
  { _id: 'inv_1', type: 'Mutual Fund', name: 'Axis Bluechip Fund', investedAmount: 500000, currentValue: 620000, memberName: 'Rajesh Sharma', startDate: '2022-03-01', status: 'active' },
  { _id: 'inv_2', type: 'SIP', name: 'HDFC Mid-Cap SIP', investedAmount: 240000, currentValue: 295000, memberName: 'Rajesh Sharma', startDate: '2022-06-01', status: 'active' },
  { _id: 'inv_3', type: 'Fixed Deposit', name: 'SBI FD 7.5%', investedAmount: 1000000, currentValue: 1075000, memberName: 'Priya Sharma', startDate: '2023-01-01', status: 'active' },
  { _id: 'inv_4', type: 'PPF', name: 'Public Provident Fund', investedAmount: 800000, currentValue: 920000, memberName: 'Rajesh Sharma', startDate: '2020-04-01', status: 'active' },
  { _id: 'inv_5', type: 'NPS', name: 'National Pension Scheme', investedAmount: 600000, currentValue: 710000, memberName: 'Rajesh Sharma', startDate: '2021-01-01', status: 'active' },
  { _id: 'inv_6', type: 'Stocks', name: 'Reliance + TCS + HDFC', investedAmount: 350000, currentValue: 480000, memberName: 'Arjun Sharma', startDate: '2022-09-01', status: 'active' },
  { _id: 'inv_7', type: 'Gold', name: 'Sovereign Gold Bond', investedAmount: 200000, currentValue: 260000, memberName: 'Suresh Sharma', startDate: '2022-11-01', status: 'active' },
  { _id: 'inv_8', type: 'LIC', name: 'LIC Jeevan Anand', investedAmount: 450000, currentValue: 520000, memberName: 'Priya Sharma', startDate: '2019-01-01', status: 'active' },
  { _id: 'inv_9', type: 'Real Estate', name: 'Plot - Sector 62 Noida', investedAmount: 2500000, currentValue: 3200000, memberName: 'Rajesh Sharma', startDate: '2021-05-01', status: 'active' },
  { _id: 'inv_10', type: 'Bonds', name: 'RBI Floating Rate Bond', investedAmount: 300000, currentValue: 330000, memberName: 'Suresh Sharma', startDate: '2023-03-01', status: 'active' }
];

const DEMO_INSURANCE = [
  { _id: 'ins_1', type: 'Health', provider: 'Star Health', policyName: 'Family Floater 10L', sumInsured: 1000000, premium: 22000, premiumFrequency: 'yearly', memberName: 'Rajesh Sharma', status: 'active', renewalDate: '2025-12-15' },
  { _id: 'ins_2', type: 'Term Life', provider: 'ICICI Prudential', policyName: 'iProtect Smart', sumInsured: 10000000, premium: 12500, premiumFrequency: 'yearly', memberName: 'Rajesh Sharma', status: 'active', renewalDate: '2025-08-01' },
  { _id: 'ins_3', type: 'Motor', provider: 'HDFC Ergo', policyName: 'Car Insurance - Swift', sumInsured: 600000, premium: 8500, premiumFrequency: 'yearly', memberName: 'Rajesh Sharma', status: 'active', renewalDate: '2025-10-20' },
  { _id: 'ins_4', type: 'Health', provider: 'Niva Bupa', policyName: 'Senior Citizen Plan', sumInsured: 500000, premium: 35000, premiumFrequency: 'yearly', memberName: 'Suresh Sharma', status: 'active', renewalDate: '2026-01-10' },
  { _id: 'ins_5', type: 'Personal Accident', provider: 'Bajaj Allianz', policyName: 'PA Cover 25L', sumInsured: 2500000, premium: 3500, premiumFrequency: 'yearly', memberName: 'Rajesh Sharma', status: 'active', renewalDate: '2025-11-05' },
  { _id: 'ins_6', type: 'Critical Illness', provider: 'Max Life', policyName: 'Critical Cover', sumInsured: 2000000, premium: 8000, premiumFrequency: 'yearly', memberName: 'Priya Sharma', status: 'active', renewalDate: '2026-02-28' }
];

const DEMO_GOALS = [
  { id: 1, name: 'Emergency Fund', target: 600000, current: 425000, icon: '🛡️', deadline: '2025-12-31', category: 'Safety' },
  { id: 2, name: 'Vacation - Maldives', target: 300000, current: 180000, icon: '✈️', deadline: '2025-09-30', category: 'Lifestyle' },
  { id: 3, name: 'New Car Down Payment', target: 500000, current: 320000, icon: '🚗', deadline: '2026-03-31', category: 'Purchase' },
  { id: 4, name: "Arjun's Education", target: 2000000, current: 950000, icon: '🎓', deadline: '2027-06-30', category: 'Education' },
  { id: 5, name: 'Home Renovation', target: 800000, current: 200000, icon: '🏠', deadline: '2026-06-30', category: 'Home' },
  { id: 6, name: 'Retirement Corpus', target: 50000000, current: 8500000, icon: '🏖️', deadline: '2045-12-31', category: 'Retirement' }
];

const DEMO_INSIGHTS = [
  { type: 'warning', title: 'High Expense Alert', message: 'Shopping expenses increased 35% this month compared to last month. Consider reviewing discretionary spending.' },
  { type: 'success', title: 'Investment Growth', message: 'Your mutual fund portfolio has grown 24% in the last year. Axis Bluechip Fund is your top performer.' },
  { type: 'info', title: 'Savings Opportunity', message: 'You could save ₹12,000/month by switching to a lower-rate home loan. Current market rates are 8.25%.' },
  { type: 'warning', title: 'EMI Burden', message: 'Total EMI payments are 42% of monthly income. Financial advisors recommend keeping it under 40%.' },
  { type: 'success', title: 'Budget Goal Met', message: 'Great job! You stayed within budget for 6 out of 8 categories this month.' },
  { type: 'info', title: 'Insurance Renewal', message: 'Star Health Family Floater is due for renewal next month. Compare plans to ensure best coverage.' },
  { type: 'success', title: 'Net Worth Growth', message: 'Family net worth increased by ₹4.8L in the last 6 months. Real estate appreciation is the biggest contributor.' },
  { type: 'info', title: 'Tax Saving Tip', message: 'You can save up to ₹46,800 in taxes by maximizing 80C investments. Current utilization: 68%.' }
];

// ========== API ROUTES ==========

// Demo login
app.post('/api/demo/login', (req, res) => {
  const { email, password } = req.body;
  if ((email === 'demo@gromofinance.com' || !email) && (password === 'demo123' || !password)) {
    res.json({ success: true, message: 'Welcome to GromoFinance Demo!', token: 'demo_token_12345', user: DEMO_USER, familyCode: 'demo-sharma-family', isDemo: true });
  } else {
    res.status(401).json({ success: false, message: 'Invalid demo credentials. Use demo@gromofinance.com / demo123' });
  }
});

// Transactions
app.get('/api/transactions', (req, res) => {
  res.json({ success: true, transactions: DEMO_TRANSACTIONS });
});

// Loans
app.get('/api/loans', (req, res) => {
  res.json({ success: true, loans: DEMO_LOANS });
});

// Investments
app.get('/api/investments', (req, res) => {
  res.json({ success: true, investments: DEMO_INVESTMENTS });
});

// Insurance
app.get('/api/insurance', (req, res) => {
  res.json({ success: true, policies: DEMO_INSURANCE });
});

// Balances
app.get('/api/balances', (req, res) => {
  res.json({ success: true, balances: [] });
});

// Goals
app.get('/api/demo/goals', (req, res) => {
  res.json({ success: true, goals: DEMO_GOALS });
});

// AI Insights
app.get('/api/demo/ai-insights', (req, res) => {
  res.json({ success: true, insights: DEMO_INSIGHTS });
});

// Demo status
app.get('/api/demo/status', (req, res) => {
  res.json({ success: true, isDemo: true, members: DEMO_MEMBERS });
});

// Demo reset
app.post('/api/demo/reset', (req, res) => {
  res.json({ success: true, message: 'Demo data reset!' });
});

// Serve index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║   🎭 GromoFinance Demo Server Running       ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log(`  ║   🌐 URL: http://localhost:${PORT}              ║`);
  console.log('  ║   📧 Email: demo@gromofinance.com           ║');
  console.log('  ║   🔑 Password: demo123                      ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
});

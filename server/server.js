require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const familyRoutes = require('./routes/family');
const transactionRoutes = require('./routes/transactions');
const budgetRoutes = require('./routes/budgets');
const loanRoutes = require('./routes/loans');
const investmentRoutes = require('./routes/investments');
const balanceRoutes = require('./routes/balances');
const adminRoutes = require('./routes/admin');
const subscriptionRoutes = require('./routes/subscription');
const insuranceRoutes = require('./routes/insurance');

const app = express();

// ========== MIDDLEWARE ==========
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// ========== API ROUTES ==========
app.use('/api/auth', authRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/balances', balanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/insurance', insuranceRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Reminder trigger endpoint (called by cron or manually)
app.get('/api/reminders/check', async (req, res) => {
  try {
    const { checkAndSendReminders } = require('./utils/reminders');
    const result = await checkAndSendReminders();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Serve frontend for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ========== ERROR HANDLER ==========
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// ========== DATABASE & START ==========
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/familyfinplan';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`🚀 FamilyFinPlan API running on port ${PORT}`);
      console.log(`📂 Frontend served from /public`);
    });

    // Run reminder check every 6 hours
    setInterval(async () => {
      try {
        const { checkAndSendReminders } = require('./utils/reminders');
        const result = await checkAndSendReminders();
        console.log(`[Auto-Reminder] ${result.emailsSent || 0} emails sent`);
      } catch (e) {
        console.log('[Auto-Reminder] Error:', e.message);
      }
    }, 6 * 60 * 60 * 1000); // Every 6 hours
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;
// deploy trigger

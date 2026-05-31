const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { authenticate } = require('../middleware/auth');

// ============ GET ALL TRANSACTIONS ============
router.get('/', authenticate, async (req, res) => {
  try {
    const { month, type, member, page = 1, limit = 100 } = req.query;
    
    const filter = { familyId: req.familyId };
    
    // Filter by month (e.g., '2024-06')
    if (month && month !== 'all') {
      const startDate = new Date(`${month}-01`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      filter.date = { $gte: startDate, $lt: endDate };
    }
    
    if (type && type !== 'all') filter.type = type;
    if (member) filter.memberName = member;

    const transactions = await Transaction.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(filter);

    res.json({
      success: true,
      transactions,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch transactions.' });
  }
});

// ============ GET DASHBOARD STATS ============
router.get('/stats', authenticate, async (req, res) => {
  try {
    const { month } = req.query;
    const filter = { familyId: req.familyId };

    if (month && month !== 'all') {
      const startDate = new Date(`${month}-01`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      filter.date = { $gte: startDate, $lt: endDate };
    }

    const stats = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const income = stats.find(s => s._id === 'income')?.total || 0;
    const expense = stats.find(s => s._id === 'expense')?.total || 0;

    // Category breakdown
    const categories = await Transaction.aggregate([
      { $match: { ...filter, type: 'expense' } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' }
        }
      },
      { $sort: { total: -1 } }
    ]);

    // Member breakdown
    const members = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { member: '$memberName', type: '$type' },
          total: { $sum: '$amount' }
        }
      }
    ]);

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const trend = await Transaction.aggregate([
      { $match: { familyId: req.familyId, date: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: '%Y-%m', date: '$date' } },
            type: '$type'
          },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      income,
      expense,
      savings: income - expense,
      balance: income - expense,
      categories,
      members,
      trend
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
});

// ============ ADD TRANSACTION ============
router.post('/', authenticate, async (req, res) => {
  try {
    const { type, category, amount, description, date, memberName, paymentMethod, bankName } = req.body;

    if (!type || !category || !amount || !date) {
      return res.status(400).json({ success: false, message: 'Type, category, amount, and date are required.' });
    }

    const transaction = await Transaction.create({
      familyId: req.familyId,
      userId: req.userId,
      type,
      category,
      amount: Number(amount),
      description: description || '',
      date: new Date(date),
      memberName: memberName || req.user.name,
      paymentMethod: paymentMethod || 'Cash',
      bankName: bankName || ''
    });

    res.status(201).json({
      success: true,
      message: 'Transaction added!',
      transaction
    });
  } catch (error) {
    console.error('Add transaction error:', error);
    res.status(500).json({ success: false, message: 'Failed to add transaction.' });
  }
});

// ============ UPDATE TRANSACTION ============
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, category, amount, description, date, memberName, paymentMethod, bankName } = req.body;

    const transaction = await Transaction.findOne({ _id: id, familyId: req.familyId });
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    if (type) transaction.type = type;
    if (category) transaction.category = category;
    if (amount) transaction.amount = Number(amount);
    if (description !== undefined) transaction.description = description;
    if (date) transaction.date = new Date(date);
    if (memberName) transaction.memberName = memberName;
    if (paymentMethod) transaction.paymentMethod = paymentMethod;
    if (bankName !== undefined) transaction.bankName = bankName;

    await transaction.save();
    res.json({ success: true, message: 'Transaction updated!', transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update transaction.' });
  }
});

// ============ DELETE TRANSACTION ============
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findOneAndDelete({ _id: id, familyId: req.familyId });
    
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    res.json({ success: true, message: 'Transaction deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete transaction.' });
  }
});

module.exports = router;

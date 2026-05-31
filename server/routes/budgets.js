const express = require('express');
const router = express.Router();
const Budget = require('../models/Budget');
const { authenticate } = require('../middleware/auth');

// GET all budgets for family
router.get('/', authenticate, async (req, res) => {
  try {
    const { month } = req.query;
    const filter = { familyId: req.familyId };
    if (month) filter.month = month;

    const budgets = await Budget.find(filter).sort({ category: 1 });
    res.json({ success: true, budgets });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch budgets.' });
  }
});

// SAVE/UPDATE budgets (batch)
router.post('/', authenticate, async (req, res) => {
  try {
    const { budgets, month } = req.body;
    const currentMonth = month || new Date().toISOString().slice(0, 7);

    for (const b of budgets) {
      await Budget.findOneAndUpdate(
        { familyId: req.familyId, category: b.category, month: currentMonth },
        { familyId: req.familyId, category: b.category, limit: b.limit, month: currentMonth },
        { upsert: true, new: true }
      );
    }

    res.json({ success: true, message: 'Budgets saved!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to save budgets.' });
  }
});

// DELETE a budget
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await Budget.findOneAndDelete({ _id: req.params.id, familyId: req.familyId });
    res.json({ success: true, message: 'Budget deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete budget.' });
  }
});

module.exports = router;

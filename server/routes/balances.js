const express = require('express');
const router = express.Router();
const Balance = require('../models/Balance');
const { authenticate } = require('../middleware/auth');

// GET balances
router.get('/', authenticate, async (req, res) => {
  try {
    const balances = await Balance.find({ familyId: req.familyId }).sort({ month: -1, vertical: 1 });
    res.json({ success: true, balances });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch balances.' });
  }
});

// ADD/UPDATE balance
router.post('/', authenticate, async (req, res) => {
  try {
    const { vertical, month, opening, closing } = req.body;
    if (!vertical || !month) {
      return res.status(400).json({ success: false, message: 'Vertical and month required.' });
    }

    const balance = await Balance.findOneAndUpdate(
      { familyId: req.familyId, vertical, month },
      { familyId: req.familyId, vertical, month, opening, closing },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Balance saved!', balance });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to save balance.' });
  }
});

// DELETE balance
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await Balance.findOneAndDelete({ _id: req.params.id, familyId: req.familyId });
    res.json({ success: true, message: 'Balance deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete balance.' });
  }
});

module.exports = router;

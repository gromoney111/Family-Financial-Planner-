const express = require('express');
const router = express.Router();
const Investment = require('../models/Investment');
const { authenticate } = require('../middleware/auth');

// GET all investments
router.get('/', authenticate, async (req, res) => {
  try {
    const investments = await Investment.find({ familyId: req.familyId }).sort({ createdAt: -1 });
    res.json({ success: true, investments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch investments.' });
  }
});

// GET investment stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const investments = await Investment.find({ familyId: req.familyId, status: 'active' });
    let totalInvested = 0, currentValue = 0;

    investments.forEach(i => {
      totalInvested += i.investedAmount;
      currentValue += i.currentValue;
    });

    const totalReturns = currentValue - totalInvested;
    const avgReturn = totalInvested > 0 ? ((totalReturns / totalInvested) * 100).toFixed(1) : 0;

    res.json({ success: true, totalInvested, currentValue, totalReturns, avgReturn });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
});

// ADD investment
router.post('/', authenticate, async (req, res) => {
  try {
    const investment = await Investment.create({
      ...req.body,
      familyId: req.familyId,
      userId: req.userId
    });
    res.status(201).json({ success: true, message: 'Investment added!', investment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add investment.' });
  }
});

// UPDATE investment
router.put('/:id', authenticate, async (req, res) => {
  try {
    const investment = await Investment.findOneAndUpdate(
      { _id: req.params.id, familyId: req.familyId },
      req.body,
      { new: true }
    );
    if (!investment) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, message: 'Investment updated!', investment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update.' });
  }
});

// DELETE investment
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await Investment.findOneAndDelete({ _id: req.params.id, familyId: req.familyId });
    res.json({ success: true, message: 'Investment deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete.' });
  }
});

// GET upcoming SIP/LIC payments
router.get('/upcoming', authenticate, async (req, res) => {
  try {
    const investments = await Investment.find({
      familyId: req.familyId,
      status: 'active',
      monthlyContribution: { $gt: 0 }
    });

    const today = new Date();
    const upcoming = [];

    investments.forEach(i => {
      if (i.paymentDueDay) {
        const nextDue = new Date(today.getFullYear(), today.getMonth(), i.paymentDueDay);
        if (nextDue < today) nextDue.setMonth(nextDue.getMonth() + 1);
        const daysUntil = Math.ceil((nextDue - today) / (1000 * 60 * 60 * 24));
        upcoming.push({
          type: i.type,
          name: i.name,
          member: i.memberName,
          dueDate: nextDue,
          amount: i.monthlyContribution,
          daysUntil,
          investmentId: i._id
        });
      }
    });

    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    res.json({ success: true, upcoming });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch upcoming.' });
  }
});

module.exports = router;

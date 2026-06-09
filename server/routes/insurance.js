const express = require('express');
const router = express.Router();
const Insurance = require('../models/Insurance');
const { authenticate } = require('../middleware/auth');

// GET all insurance policies
router.get('/', authenticate, async (req, res) => {
  try {
    const policies = await Insurance.find({ familyId: req.familyId }).sort({ renewalDate: 1 });
    res.json({ success: true, policies });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch policies.' });
  }
});

// GET insurance stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const policies = await Insurance.find({ familyId: req.familyId, status: 'active' });
    const totalPolicies = policies.length;
    const totalPremium = policies.reduce((s, p) => s + p.premium, 0);
    const totalCoverage = policies.reduce((s, p) => s + p.sumInsured, 0);
    
    // Upcoming renewals (next 30 days)
    const today = new Date();
    const next30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcomingRenewals = policies.filter(p => p.renewalDate >= today && p.renewalDate <= next30);

    res.json({ 
      success: true, 
      totalPolicies, 
      totalPremium, 
      totalCoverage, 
      upcomingRenewals: upcomingRenewals.length,
      yearlyPremium: totalPremium // Most are yearly
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
});

// ADD insurance policy
router.post('/', authenticate, async (req, res) => {
  try {
    const policy = await Insurance.create({
      ...req.body,
      familyId: req.familyId,
      userId: req.userId
    });
    res.status(201).json({ success: true, message: 'Policy added!', policy });
  } catch (error) {
    console.error('Add insurance error:', error);
    res.status(500).json({ success: false, message: 'Failed to add policy.' });
  }
});

// UPDATE policy
router.put('/:id', authenticate, async (req, res) => {
  try {
    const policy = await Insurance.findOneAndUpdate(
      { _id: req.params.id, familyId: req.familyId },
      req.body,
      { new: true }
    );
    if (!policy) return res.status(404).json({ success: false, message: 'Policy not found.' });
    res.json({ success: true, message: 'Policy updated!', policy });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update.' });
  }
});

// DELETE policy
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await Insurance.findOneAndDelete({ _id: req.params.id, familyId: req.familyId });
    res.json({ success: true, message: 'Policy deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete.' });
  }
});

// GET upcoming renewals
router.get('/upcoming', authenticate, async (req, res) => {
  try {
    const today = new Date();
    const next60 = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    
    const upcoming = await Insurance.find({
      familyId: req.familyId,
      status: 'active',
      renewalDate: { $gte: today, $lte: next60 }
    }).sort({ renewalDate: 1 });

    const result = upcoming.map(p => {
      const daysUntil = Math.ceil((p.renewalDate - today) / (1000 * 60 * 60 * 24));
      return {
        id: p._id,
        type: p.type,
        policyName: p.policyName,
        provider: p.provider,
        memberName: p.memberName,
        premium: p.premium,
        renewalDate: p.renewalDate,
        daysUntil
      };
    });

    res.json({ success: true, upcoming: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch upcoming.' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Loan = require('../models/Loan');
const { authenticate } = require('../middleware/auth');

// GET all loans
router.get('/', authenticate, async (req, res) => {
  try {
    const loans = await Loan.find({ familyId: req.familyId }).sort({ createdAt: -1 });
    res.json({ success: true, loans });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch loans.' });
  }
});

// GET loan stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const loans = await Loan.find({ familyId: req.familyId, status: 'active' });
    let totalLoan = 0, totalEMI = 0, totalPaid = 0;

    loans.forEach(l => {
      const r = l.rate / 12 / 100;
      const totalWithInterest = l.emi * l.tenure;
      totalLoan += totalWithInterest;
      totalEMI += l.emi;
      totalPaid += l.emi * l.emisPaid;
    });

    res.json({
      success: true,
      totalLoan,
      totalEMI,
      totalPaid,
      balancePrincipal: totalLoan - totalPaid,
      activeLoans: loans.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch loan stats.' });
  }
});

// ADD loan
router.post('/', authenticate, async (req, res) => {
  try {
    const loan = await Loan.create({ ...req.body, familyId: req.familyId, userId: req.userId });
    res.status(201).json({ success: true, message: 'Loan added!', loan });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add loan.' });
  }
});

// UPDATE loan
router.put('/:id', authenticate, async (req, res) => {
  try {
    const loan = await Loan.findOneAndUpdate(
      { _id: req.params.id, familyId: req.familyId },
      req.body,
      { new: true }
    );
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found.' });
    res.json({ success: true, message: 'Loan updated!', loan });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update loan.' });
  }
});

// PAY EMI
router.post('/:id/pay-emi', authenticate, async (req, res) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, familyId: req.familyId });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found.' });

    const r = loan.rate / 12 / 100;
    const balance = loan.principal * Math.pow(1 + r, loan.emisPaid)
      - (loan.emi * (Math.pow(1 + r, loan.emisPaid) - 1) / r);
    const interestPortion = balance * r;
    const principalPortion = loan.emi - interestPortion;
    const remaining = Math.max(0, balance - principalPortion);

    loan.payments.push({
      date: new Date(),
      amount: loan.emi,
      principalPortion: Math.round(principalPortion),
      interestPortion: Math.round(interestPortion),
      remainingBalance: Math.round(remaining)
    });
    loan.emisPaid += 1;

    if (loan.emisPaid >= loan.tenure) loan.status = 'paid';
    await loan.save();

    res.json({ success: true, message: 'EMI payment recorded!', loan });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to record EMI.' });
  }
});

// DELETE loan
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await Loan.findOneAndDelete({ _id: req.params.id, familyId: req.familyId });
    res.json({ success: true, message: 'Loan deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete loan.' });
  }
});

// GET upcoming payments (EMIs due soon)
router.get('/upcoming', authenticate, async (req, res) => {
  try {
    const loans = await Loan.find({ familyId: req.familyId, status: 'active' });
    const today = new Date();
    const upcoming = [];

    loans.forEach(l => {
      const dueDay = l.emiDueDay || 5;
      const nextDue = new Date(today.getFullYear(), today.getMonth(), dueDay);
      if (nextDue < today) nextDue.setMonth(nextDue.getMonth() + 1);

      const daysUntil = Math.ceil((nextDue - today) / (1000 * 60 * 60 * 24));
      upcoming.push({
        type: 'EMI',
        name: `${l.type} - ${l.lender}`,
        member: l.memberName,
        dueDate: nextDue,
        amount: l.emi,
        daysUntil,
        loanId: l._id
      });
    });

    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    res.json({ success: true, upcoming });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch upcoming.' });
  }
});

module.exports = router;

const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  memberName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Mutual Fund', 'Fixed Deposit', 'PPF', 'NPS', 'Stocks', 'Gold', 'Real Estate', 'LIC', 'Bonds', 'SIP', 'Other']
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  investedAmount: {
    type: Number,
    required: true,
    min: 0
  },
  currentValue: {
    type: Number,
    required: true,
    min: 0
  },
  startDate: {
    type: Date,
    required: true
  },
  maturityDate: {
    type: Date
  },
  paymentDueDay: {
    type: Number, // For SIP/LIC - day of month payment due
    default: null
  },
  monthlyContribution: {
    type: Number, // For SIP/LIC monthly payment
    default: 0
  },
  expectedReturn: {
    type: Number, // percentage
    default: 0
  },
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'matured', 'withdrawn'],
    default: 'active'
  }
}, {
  timestamps: true
});

investmentSchema.index({ familyId: 1, status: 1 });

module.exports = mongoose.model('Investment', investmentSchema);

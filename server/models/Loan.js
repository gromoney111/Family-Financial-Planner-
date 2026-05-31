const mongoose = require('mongoose');

const emiPaymentSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  amount: { type: Number, required: true },
  principalPortion: { type: Number, default: 0 },
  interestPortion: { type: Number, default: 0 },
  remainingBalance: { type: Number, default: 0 }
}, { _id: true, timestamps: true });

const loanSchema = new mongoose.Schema({
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
    enum: ['Home Loan', 'Car Loan', 'Personal Loan', 'Education Loan', 'Gold Loan', 'Business Loan', 'Credit Card', 'Other']
  },
  lender: {
    type: String,
    required: true,
    trim: true
  },
  principal: {
    type: Number,
    required: true,
    min: 1
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  tenure: {
    type: Number, // in months
    required: true,
    min: 1
  },
  emi: {
    type: Number,
    required: true,
    min: 0
  },
  startDate: {
    type: Date,
    required: true
  },
  emisPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  emiDueDay: {
    type: Number, // Day of month EMI is due (1-31)
    default: 5
  },
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'paid', 'defaulted'],
    default: 'active'
  },
  payments: [emiPaymentSchema]
}, {
  timestamps: true
});

loanSchema.index({ familyId: 1, status: 1 });

module.exports = mongoose.model('Loan', loanSchema);

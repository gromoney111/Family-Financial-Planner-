const mongoose = require('mongoose');

const insuranceSchema = new mongoose.Schema({
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
    enum: ['Health', 'Term Life', 'Motor', 'Home', 'Travel', 'Personal Accident', 'Critical Illness', 'Other']
  },
  provider: {
    type: String,
    required: true,
    trim: true
  },
  policyNumber: {
    type: String,
    trim: true,
    default: ''
  },
  policyName: {
    type: String,
    required: true,
    trim: true
  },
  sumInsured: {
    type: Number,
    required: true,
    min: 0
  },
  premium: {
    type: Number,
    required: true,
    min: 0
  },
  premiumFrequency: {
    type: String,
    enum: ['monthly', 'quarterly', 'half-yearly', 'yearly'],
    default: 'yearly'
  },
  startDate: {
    type: Date,
    required: true
  },
  renewalDate: {
    type: Date,
    required: true
  },
  nominees: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'claimed'],
    default: 'active'
  }
}, {
  timestamps: true
});

insuranceSchema.index({ familyId: 1, status: 1 });
insuranceSchema.index({ renewalDate: 1 });

module.exports = mongoose.model('Insurance', insuranceSchema);

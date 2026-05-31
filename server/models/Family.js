const mongoose = require('mongoose');

const familySchema = new mongoose.Schema({
  familyCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  familyName: {
    type: String,
    required: true,
    trim: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  maxMembers: {
    type: Number,
    default: 6
  },
  inviteCode: {
    type: String,
    unique: true,
    sparse: true
  },
  inviteExpiry: Date,
  settings: {
    currency: { type: String, default: '₹' },
    locale: { type: String, default: 'en-IN' }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Generate invite code
familySchema.methods.generateInviteCode = function() {
  const code = this.familyCode + '_' + Date.now().toString(36);
  this.inviteCode = code;
  this.inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  return code;
};

// Check if invite is valid
familySchema.methods.isInviteValid = function() {
  return this.inviteCode && this.inviteExpiry && new Date() < this.inviteExpiry;
};

// Check if family is full
familySchema.methods.isFull = function() {
  return this.members.length >= this.maxMembers;
};

module.exports = mongoose.model('Family', familySchema);

const mongoose = require('mongoose');

const balanceSchema = new mongoose.Schema({
  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family',
    required: true,
    index: true
  },
  vertical: {
    type: String,
    required: true,
    trim: true
  },
  month: {
    type: String, // Format: '2024-06'
    required: true
  },
  opening: {
    type: Number,
    required: true,
    default: 0
  },
  closing: {
    type: Number,
    required: true,
    default: 0
  }
}, {
  timestamps: true
});

balanceSchema.index({ familyId: 1, month: -1 });

module.exports = mongoose.model('Balance', balanceSchema);

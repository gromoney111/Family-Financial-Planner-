const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Family',
    required: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  limit: {
    type: Number,
    required: true,
    min: 1
  },
  month: {
    type: String, // Format: '2024-06'
    required: true
  }
}, {
  timestamps: true
});

budgetSchema.index({ familyId: 1, month: 1 });

module.exports = mongoose.model('Budget', budgetSchema);

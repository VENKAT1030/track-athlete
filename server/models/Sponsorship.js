const mongoose = require('mongoose');

const SponsorshipSchema = new mongoose.Schema({
  sponsor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sport: { type: String, trim: true },
  upcomingEvent: { type: String, trim: true },
  eventLevel: { type: String, enum: ['NATIONAL', 'INTERNATIONAL', 'STATE', 'DISTRICT', 'OTHER'], trim: true },
  expectedEventDate: Date,
  requirementDescription: { type: String, trim: true },
  proposedAmount: Number,
  amount: Number,
  supportType: String,
  message: String,
  rejectionNote: String,
  status: {
    type: String,
    enum: ['PENDING', 'NEGOTIATING', 'ACCEPTED', 'REJECTED', 'ACTIVE', 'CANCELLED', 'COMPLETED', 'Proposed', 'Active', 'Closed'],
    default: 'PENDING',
    index: true
  },
  fundUseLog: [{
    date: { type: Date, default: Date.now },
    description: String,
    amount: Number
  }]
}, {
  timestamps: true
});

SponsorshipSchema.index({ sponsor: 1, athlete: 1, sport: 1, status: 1 });

module.exports = mongoose.model('Sponsorship', SponsorshipSchema);

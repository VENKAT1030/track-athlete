const mongoose = require('mongoose');

const sponsorMessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SponsorConversation',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

sponsorMessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('SponsorMessage', sponsorMessageSchema);

const mongoose = require('mongoose');

const sponsorConversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  sponsorshipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sponsorship'
  },
  lastMessage: {
    type: String,
    default: ''
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

sponsorConversationSchema.index({ participants: 1 });

module.exports = mongoose.model('SponsorConversation', sponsorConversationSchema);

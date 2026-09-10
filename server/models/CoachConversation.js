const mongoose = require('mongoose');

const CoachConversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessage: { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });

CoachConversationSchema.index({ participants: 1 });
CoachConversationSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('CoachConversation', CoachConversationSchema);

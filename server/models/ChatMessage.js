// server/models/ChatMessage.js
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
  // Remove after #108 migrates existing chat messages.
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household' },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'Roommate', required: true },
  text: { type: String, required: true },
  relatedType: { type: String, enum: ['chore', 'expense', null], default: null },
  relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);

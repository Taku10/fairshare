const mongoose = require('mongoose');

const householdMembershipSchema = new mongoose.Schema({
  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Roommate', required: true },
  role: { type: String, enum: ['owner', 'member'], required: true },
  status: { type: String, enum: ['active'], default: 'active', required: true },
  joinedAt: { type: Date, default: Date.now },
}, { timestamps: true });

householdMembershipSchema.index({ householdId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('HouseholdMembership', householdMembershipSchema);
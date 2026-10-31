const mongoose = require('mongoose');

const householdSchema = new mongoose.Schema({
  name: { type: String, required: true },        // "Apartment 3B"
  code: { type: String, unique: true },          // invite code; revoking expires it
  codeExpiresAt: { type: Date },                 // codes without an expiry are treated as expired
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Roommate', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Roommate' }],
  createdAt: { type: Date, default: Date.now },
}, {
  // Keep using the existing collection so this rename does not hide current data.
  collection: 'rooms',
});

module.exports = mongoose.model('Household', householdSchema);

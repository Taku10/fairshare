const mongoose = require('mongoose');

const householdSchema = new mongoose.Schema({
  name: { type: String, required: true },        // "Apartment 3B"
  code: { type: String, unique: true },          // invite code like "3B-XYZ"
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Roommate', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Roommate' }],
  createdAt: { type: Date, default: Date.now },
}, {
  // Keep using the existing collection so this rename does not hide current data.
  collection: 'rooms',
});

module.exports = mongoose.model('Household', householdSchema);

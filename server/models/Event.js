const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: false, default: null },
  // Remove after #108 migrates existing events.
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  eventType: { 
    type: String, 
    enum: ['party', 'guest', 'maintenance', 'bill', 'other'], 
    default: 'other' 
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  allDay: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Roommate', required: true },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Roommate' }],
  location: { type: String, default: '' },
  recurring: {
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], default: 'monthly' }
  },
  billAmount: { type: Number }, // For bill-type events
  isPaid: { type: Boolean, default: false }, // For bill-type events
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);

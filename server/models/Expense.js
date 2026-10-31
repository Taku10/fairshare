// server/models/Expense.js
const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({

  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
  // Remove after #108 migrates existing expenses.
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household' },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Roommate', required: true },
  splitBetween: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Roommate', required: true }],
  date: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

expenseSchema.index({ householdId: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);

// server/models/Expense.js
const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({

  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: false, default: null },
  // Remove after #108 migrates existing expenses.
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household' },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Roommate', required: true },
  splitBetween: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Roommate', required: true }],
  date: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Expense', expenseSchema);

// server/routes/expenses.js
const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Roommate = require('../models/Roommate');
const Household = require('../models/Household');

async function getOrCreateDefaultHouseholdFor(roommateId) {
  let household = await Household.findOne({ name: { $in: ['Default Household', 'Default Room'] } });
  if (!household) {
    household = await Household.create({ name: 'Default Household', createdBy: roommateId, members: [roommateId] });
  } else {
    const isMember = household.members.some((m) => String(m) === String(roommateId));
    if (!isMember) {
      household.members.push(roommateId);
      await household.save();
    }
  }
  return household;
}

// CREATE expense
router.post('/', async (req, res) => {
  try {
    console.log('📥 POST /expenses received:', JSON.stringify(req.body, null, 2));
    console.log('   Current user roommateId:', req.user.roommateId);
    
    // Basic payload validation and normalization
    const { description, amount, paidBy } = req.body;
    let splitBetween = Array.isArray(req.body.splitBetween) ? req.body.splitBetween : [];
    if (!description || !String(description).trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }
    const parsedAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    if (!paidBy) {
      return res.status(400).json({ error: 'paidBy is required' });
    }
    // Ensure payer is included in splitBetween once
    splitBetween = splitBetween.map(String);
    const paidByStr = String(paidBy);
    if (!splitBetween.includes(paidByStr)) {
      splitBetween.push(paidByStr);
    }
    // De-duplicate splitBetween
    splitBetween = Array.from(new Set(splitBetween));
    req.body.amount = parsedAmount;
    req.body.splitBetween = splitBetween;

    if (!req.body.householdId) {
      console.log('   No household reference provided, creating/finding default household...');
      const defaultHousehold = await getOrCreateDefaultHouseholdFor(req.user.roommateId);
      console.log('   Default household ID:', defaultHousehold._id);
      req.body.householdId = defaultHousehold._id;
    }

    console.log('   Creating expense with payload:', JSON.stringify(req.body, null, 2));
    const expense = await Expense.create(req.body);
    console.log('✅ Expense created successfully:', expense._id);
    // Populate using a follow-up query to avoid chained populate issues
    const populated = await Expense.findById(expense._id)
      .populate('paidBy')
      .populate('splitBetween');
    res.status(201).json(populated);
  } catch (err) {
    console.error('❌ Expense creation failed:', err.message);
    console.error('   Validation errors:', err.errors);
    // Provide more detailed feedback when available
    if (err?.errors) {
      const details = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: err.message, details });
    }
    res.status(400).json({ error: err.message });
  }
});

// READ all expenses (populated)
router.get('/', async (req, res) => {
  try {
    const expenses = await Expense
      .find()
      .sort({ date: -1 })
      .populate('paidBy')
      .populate('splitBetween');
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE expense
router.put('/:id', async (req, res) => {
  try {
    const { description, amount, paidBy, splitBetween } = req.body;
    
    // Build update object with only allowed fields
    const updateFields = {};
    
    if (description !== undefined) {
      const trimmedDesc = String(description).trim();
      if (!trimmedDesc) {
        return res.status(400).json({ error: 'Description cannot be empty' });
      }
      updateFields.description = trimmedDesc.substring(0, 100);
    }
    
    if (amount !== undefined) {
      const parsedAmount = typeof amount === 'number' ? amount : parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
      }
      updateFields.amount = parsedAmount;
    }
    
    if (paidBy !== undefined) {
      // Validate ObjectId format
      if (!paidBy || typeof paidBy !== 'string' || !/^[a-f\d]{24}$/i.test(paidBy)) {
        return res.status(400).json({ error: 'Invalid paidBy ID' });
      }
      updateFields.paidBy = paidBy;
    }
    
    if (splitBetween !== undefined) {
      if (!Array.isArray(splitBetween) || splitBetween.length === 0) {
        return res.status(400).json({ error: 'splitBetween must be a non-empty array' });
      }
      // Validate all ObjectIds in the array
      for (const id of splitBetween) {
        if (!id || typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
          return res.status(400).json({ error: 'Invalid ID in splitBetween' });
        }
      }
      updateFields.splitBetween = splitBetween;
    }
    
    const updated = await Expense.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    ).populate('paidBy').populate('splitBetween');
    
    if (!updated) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE expense
router.delete('/:id', async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// READ balances (who owes who)
router.get('/balances/summary', async (req, res) => {
  try {
    const expenses = await Expense.find().populate('paidBy').populate('splitBetween');

    // balances[roommateId] = net money (positive: they should receive)
    const balances = {};

    for (const exp of expenses) {
      // Skip expenses with missing/deleted paidBy reference
      if (!exp.paidBy) continue;

      const validSplit = (exp.splitBetween || []).filter(Boolean);
      if (validSplit.length === 0) continue;

      const share = exp.amount / validSplit.length;
      const payerId = String(exp.paidBy._id);

      // make sure payer exists in balances
      balances[payerId] = (balances[payerId] || 0);

      // each participant owes "share"
      for (const rm of validSplit) {
        const rmId = String(rm._id);
        balances[rmId] = (balances[rmId] || 0);

        if (rmId === payerId) {
          // they paid and owe their own share: net 0 for this share
          continue;
        }

        // participant owes payer
        balances[rmId] -= share;
        balances[payerId] += share;
      }
    }

    // return only the logged-in user's balance
    const meId = String(req.user.roommateId);
    const me = await Roommate.findById(meId);
    const payload = [{
      roommateId: me?._id,
      name: me?.displayName || (me?.email ? me.email.split('@')[0] : 'Me'),
      balance: balances[meId] || 0,
    }];

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

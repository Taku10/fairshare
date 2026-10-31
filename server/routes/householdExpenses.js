const express = require('express');
const Expense = require('../models/Expense');
const HouseholdMembership = require('../models/HouseholdMembership');
const { requireHouseholdMembership } = require('../middleware/householdMembership');

// Mounted at /api/households/:householdId/expenses
const router = express.Router({ mergeParams: true });

const OBJECT_ID = /^[a-f\d]{24}$/i;
const MAX_SPLIT = 50;

router.use(requireHouseholdMembership);

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function parseDescription(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.trim().substring(0, 100);
}

function parseAmount(value) {
  const amount = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function parseUserId(value, label) {
  if (typeof value !== 'string' || !OBJECT_ID.test(value)) {
    throw badRequest(`Invalid ${label} ID`);
  }
  return value;
}

async function assertActiveMembers(householdId, userIds) {
  const results = await Promise.all(
    userIds.map((userId) =>
      HouseholdMembership.findOne({ householdId, userId, status: 'active' })
    )
  );
  if (results.some((membership) => !membership)) {
    throw badRequest('Payer and split members must belong to this household');
  }
}

function parseSplit(value) {
  if (!Array.isArray(value)) throw badRequest('splitBetween must be an array');
  const ids = Array.from(new Set(value.map((id) => parseUserId(id, 'splitBetween'))));
  if (ids.length > MAX_SPLIT) throw badRequest('splitBetween has too many members');
  return ids;
}

function parseDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest('Invalid date');
  return date;
}

function handleError(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid expense data' });
  }
  return res.status(500).json({ error: fallback });
}

function validExpenseId(req, res) {
  if (!OBJECT_ID.test(req.params.expenseId || '')) {
    res.status(400).json({ error: 'Invalid expense ID' });
    return false;
  }
  return true;
}

router.get('/', async (req, res) => {
  try {
    const expenses = await Expense.find({ householdId: req.household._id })
      .sort({ date: -1 })
      .populate('paidBy')
      .populate('splitBetween');
    res.json(expenses);
  } catch (err) {
    handleError(res, err, 'Failed to fetch expenses');
  }
});

// Declared before '/:expenseId' so "balances" is not treated as an ID.
router.get('/balances/summary', async (req, res) => {
  try {
    const expenses = await Expense.find({ householdId: req.household._id });
    const balances = {};

    for (const expense of expenses) {
      const split = (expense.splitBetween || []).map(String);
      if (!expense.paidBy || split.length === 0) continue;

      const share = expense.amount / split.length;
      const payerId = String(expense.paidBy);
      balances[payerId] = balances[payerId] || 0;

      for (const participantId of split) {
        balances[participantId] = balances[participantId] || 0;
        if (participantId === payerId) continue;
        balances[participantId] -= share;
        balances[payerId] += share;
      }
    }

    const meId = String(req.user.roommateId);
    res.json([
      {
        roommateId: req.user.roommateId,
        name: req.user.displayName || 'Me',
        balance: balances[meId] || 0,
      },
    ]);
  } catch (err) {
    handleError(res, err, 'Failed to calculate balances');
  }
});

router.get('/:expenseId', async (req, res) => {
  if (!validExpenseId(req, res)) return;
  try {
    const expense = await Expense.findOne({
      _id: req.params.expenseId,
      householdId: req.household._id,
    })
      .populate('paidBy')
      .populate('splitBetween');
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (err) {
    handleError(res, err, 'Failed to fetch expense');
  }
});

router.post('/', async (req, res) => {
  try {
    const description = parseDescription(req.body.description);
    if (!description) return res.status(400).json({ error: 'Description is required' });

    const amount = parseAmount(req.body.amount);
    if (!amount) return res.status(400).json({ error: 'Amount must be a positive number' });

    if (!req.body.paidBy) return res.status(400).json({ error: 'paidBy is required' });
    const paidBy = parseUserId(req.body.paidBy, 'paidBy');

    const split = req.body.splitBetween === undefined ? [] : parseSplit(req.body.splitBetween);
    const splitBetween = Array.from(new Set([...split, paidBy]));
    await assertActiveMembers(req.household._id, splitBetween);

    const fields = { description, amount, paidBy, splitBetween };
    if (req.body.date !== undefined) fields.date = parseDate(req.body.date);

    const expense = await Expense.create({ ...fields, householdId: req.household._id });
    const populated = await Expense.findOne({
      _id: expense._id,
      householdId: req.household._id,
    })
      .populate('paidBy')
      .populate('splitBetween');
    res.status(201).json(populated);
  } catch (err) {
    handleError(res, err, 'Failed to create expense');
  }
});

router.put('/:expenseId', async (req, res) => {
  if (!validExpenseId(req, res)) return;
  try {
    const updates = {};

    if (req.body.description !== undefined) {
      const description = parseDescription(req.body.description);
      if (!description) return res.status(400).json({ error: 'Description cannot be empty' });
      updates.description = description;
    }
    if (req.body.amount !== undefined) {
      const amount = parseAmount(req.body.amount);
      if (!amount) return res.status(400).json({ error: 'Amount must be a positive number' });
      updates.amount = amount;
    }
    if (req.body.date !== undefined) updates.date = parseDate(req.body.date);

    const referenced = [];
    if (req.body.paidBy !== undefined) {
      updates.paidBy = parseUserId(req.body.paidBy, 'paidBy');
      referenced.push(updates.paidBy);
    }
    if (req.body.splitBetween !== undefined) {
      const split = parseSplit(req.body.splitBetween);
      if (split.length === 0) {
        return res.status(400).json({ error: 'splitBetween must be a non-empty array' });
      }
      updates.splitBetween = split;
      referenced.push(...split);
    }
    await assertActiveMembers(req.household._id, Array.from(new Set(referenced)));

    // householdId and every other field in the body are intentionally ignored.
    const updated = await Expense.findOneAndUpdate(
      { _id: req.params.expenseId, householdId: req.household._id },
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('paidBy')
      .populate('splitBetween');

    if (!updated) return res.status(404).json({ error: 'Expense not found' });
    res.json(updated);
  } catch (err) {
    handleError(res, err, 'Failed to update expense');
  }
});

router.delete('/:expenseId', async (req, res) => {
  if (!validExpenseId(req, res)) return;
  try {
    const deleted = await Expense.findOneAndDelete({
      _id: req.params.expenseId,
      householdId: req.household._id,
    });
    if (!deleted) return res.status(404).json({ error: 'Expense not found' });
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    handleError(res, err, 'Failed to delete expense');
  }
});

module.exports = router;

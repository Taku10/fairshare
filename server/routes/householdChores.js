const express = require('express');
const Chore = require('../models/Chore');
const HouseholdMembership = require('../models/HouseholdMembership');
const { requireHouseholdMembership } = require('../middleware/householdMembership');

// Mounted at /api/households/:householdId/chores
const router = express.Router({ mergeParams: true });

const OBJECT_ID = /^[a-f\d]{24}$/i;

router.use(requireHouseholdMembership);

// Resolves to an id string, null (unassigned), or throws a 400 message.
async function resolveAssignee(householdId, value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !OBJECT_ID.test(value)) {
    const err = new Error('Invalid assignedTo ID');
    err.status = 400;
    throw err;
  }
  const membership = await HouseholdMembership.findOne({
    householdId,
    userId: value,
    status: 'active',
  });
  if (!membership) {
    const err = new Error('assignedTo must be a member of this household');
    err.status = 400;
    throw err;
  }
  return value;
}

function parseTitle(title) {
  if (typeof title !== 'string' || !title.trim()) return null;
  return title.trim().substring(0, 100);
}

function parseDueDate(value) {
  if (value === null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function handleError(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid chore data' });
  }
  return res.status(500).json({ error: fallback });
}

function validChoreId(req, res) {
  if (!OBJECT_ID.test(req.params.choreId || '')) {
    res.status(400).json({ error: 'Invalid chore ID' });
    return false;
  }
  return true;
}

router.get('/', async (req, res) => {
  try {
    const chores = await Chore.find({ householdId: req.household._id })
      .sort({ createdAt: -1 })
      .populate('assignedTo');
    res.json(chores);
  } catch (err) {
    handleError(res, err, 'Failed to fetch chores');
  }
});

router.get('/:choreId', async (req, res) => {
  if (!validChoreId(req, res)) return;
  try {
    const chore = await Chore.findOne({
      _id: req.params.choreId,
      householdId: req.household._id,
    }).populate('assignedTo');
    if (!chore) return res.status(404).json({ error: 'Chore not found' });
    res.json(chore);
  } catch (err) {
    handleError(res, err, 'Failed to fetch chore');
  }
});

router.post('/', async (req, res) => {
  try {
    const title = parseTitle(req.body.title);
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const fields = { title };
    if (req.body.description !== undefined) {
      fields.description = String(req.body.description).substring(0, 500);
    }
    if (req.body.dueDate !== undefined) {
      const dueDate = parseDueDate(req.body.dueDate);
      if (dueDate === undefined) return res.status(400).json({ error: 'Invalid dueDate' });
      fields.dueDate = dueDate;
    }
    if (req.body.assignedTo !== undefined) {
      fields.assignedTo = await resolveAssignee(req.household._id, req.body.assignedTo);
    }

    const chore = await Chore.create({ ...fields, householdId: req.household._id });
    const populated = await Chore.findOne({
      _id: chore._id,
      householdId: req.household._id,
    }).populate('assignedTo');
    res.status(201).json(populated);
  } catch (err) {
    handleError(res, err, 'Failed to create chore');
  }
});

router.put('/:choreId', async (req, res) => {
  if (!validChoreId(req, res)) return;
  try {
    const updates = {};

    if (req.body.title !== undefined) {
      const title = parseTitle(req.body.title);
      if (!title) return res.status(400).json({ error: 'Title cannot be empty' });
      updates.title = title;
    }
    if (req.body.description !== undefined) {
      updates.description = String(req.body.description).substring(0, 500);
    }
    if (req.body.dueDate !== undefined) {
      const dueDate = parseDueDate(req.body.dueDate);
      if (dueDate === undefined) return res.status(400).json({ error: 'Invalid dueDate' });
      updates.dueDate = dueDate;
    }
    if (req.body.assignedTo !== undefined) {
      updates.assignedTo = await resolveAssignee(req.household._id, req.body.assignedTo);
    }
    if (req.body.completed !== undefined) {
      updates.completed = Boolean(req.body.completed);
      updates.completedAt = updates.completed ? new Date() : null;
    }

    // householdId and every other field in the body are intentionally ignored.
    const updated = await Chore.findOneAndUpdate(
      { _id: req.params.choreId, householdId: req.household._id },
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('assignedTo');

    if (!updated) return res.status(404).json({ error: 'Chore not found' });
    res.json(updated);
  } catch (err) {
    handleError(res, err, 'Failed to update chore');
  }
});

router.delete('/:choreId', async (req, res) => {
  if (!validChoreId(req, res)) return;
  try {
    const deleted = await Chore.findOneAndDelete({
      _id: req.params.choreId,
      householdId: req.household._id,
    });
    if (!deleted) return res.status(404).json({ error: 'Chore not found' });
    res.json({ message: 'Chore deleted' });
  } catch (err) {
    handleError(res, err, 'Failed to delete chore');
  }
});

module.exports = router;

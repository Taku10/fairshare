
const express = require('express');
const router = express.Router();
const Chore = require('../models/Chore');
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

//So this is where all all the CRUD operations will go for chores


//Creating a new chore
router.post('/', async (req, res) => {
  try {
    // Basic validation
    const { title } = req.body;
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!req.body.householdId) {
      const defaultHousehold = await getOrCreateDefaultHouseholdFor(req.user.roommateId);
      req.body.householdId = defaultHousehold._id;
    }

    const chore = await Chore.create(req.body);
    const populated = await Chore.findById(chore._id).populate('assignedTo');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// View or read all chores
router.get('/', async (req, res) => {
  try {
    const chores = await Chore.find().sort({ createdAt: -1 }).populate('assignedTo');
    res.json(chores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a chore by id
router.put('/:id', async (req, res) => {
  try {
    const { title, assignedTo, completed, householdId } = req.body;

    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid chore ID' });
    }
    
    // Build update object with only allowed fields
    const updateFields = {};
    if (title !== undefined) {
      if (typeof title !== 'string') {
        return res.status(400).json({ error: 'Title must be a string' });
      }
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        return res.status(400).json({ error: 'Title cannot be empty' });
      }
      updateFields.title = trimmedTitle.substring(0, 100);
    }
    if (assignedTo !== undefined) {
      let assignedToId = assignedTo;

      // Accept populated object format: { _id: "..." }
      if (assignedToId && typeof assignedToId === 'object') {
        if (!Object.prototype.hasOwnProperty.call(assignedToId, '_id')) {
          return res.status(400).json({ error: 'Invalid assignedTo format' });
        }
        assignedToId = assignedToId._id;
        if (!assignedToId) {
          return res.status(400).json({ error: 'Invalid assignedTo format' });
        }
      }
      if (assignedToId && typeof assignedToId !== 'string') {
        return res.status(400).json({ error: 'Invalid assignedTo ID' });
      }

      // Allow null/empty to unassign, otherwise validate ObjectId format
      if (assignedToId && !/^[a-f\d]{24}$/i.test(assignedToId)) {
        return res.status(400).json({ error: 'Invalid assignedTo ID' });
      }
      updateFields.assignedTo = assignedToId || null;
    }
    if (householdId !== undefined) {
      let householdIdValue = householdId;
      if (householdIdValue && typeof householdIdValue === 'object') {
        if (!Object.prototype.hasOwnProperty.call(householdIdValue, '_id')) {
          return res.status(400).json({ error: 'Invalid household ID format' });
        }
        householdIdValue = householdIdValue._id;
      }
      if (householdIdValue && typeof householdIdValue !== 'string') {
        return res.status(400).json({ error: 'Invalid household ID' });
      }
      if (!householdIdValue || !/^[a-f\d]{24}$/i.test(householdIdValue)) {
        return res.status(400).json({ error: 'Invalid household ID' });
      }
      updateFields.householdId = householdIdValue;
    }
    if (completed !== undefined) {
      updateFields.completed = Boolean(completed);
    }
    
    const updated = await Chore.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate('assignedTo');
    
    if (!updated) {
      return res.status(404).json({ error: 'Chore not found' });
    }
    
    res.json(updated);
  } catch (err) {
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to update chore' });
  }
});

// Remove or delete a chore by id
router.delete('/:id', async (req, res) => {
  try {
    await Chore.findByIdAndDelete(req.params.id);
    res.json({ message: 'Chore deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

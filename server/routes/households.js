const express = require('express');
const router = express.Router({ mergeParams: true });
const Household = require('../models/Household');

// Create a household
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const household = await Household.create({
      name,
      createdBy: req.user.roommateId,
      members: [req.user.roommateId],
      code: Math.random().toString(36).substring(2, 8).toUpperCase(),
    });
    res.status(201).json(household);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all households for the current user
router.get('/', async (req, res) => {
  try {
    const households = await Household.find({ members: req.user.roommateId })
      .populate('members')
      .populate('createdBy')
      .sort({ createdAt: -1 });
    res.json(households);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific household
router.get('/:householdId', async (req, res) => {
  try {
    const household = await Household.findById(req.params.householdId)
      .populate('members')
      .populate('createdBy');
    if (!household) return res.status(404).json({ error: 'Household not found' });
    res.json(household);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Join a household by invite code
router.post('/join/:code', async (req, res) => {
  try {
    const household = await Household.findOne({ code: req.params.code });
    if (!household) return res.status(404).json({ error: 'Household not found' });

    if (!household.members.includes(req.user.roommateId)) {
      household.members.push(req.user.roommateId);
      await household.save();
    }

    await household.populate(['members', 'createdBy']);
    res.json(household);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update a household
router.put('/:householdId', async (req, res) => {
  try {
    const household = await Household.findById(req.params.householdId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    // Only creator can update
    if (String(household.createdBy) !== String(req.user.roommateId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await Household.findByIdAndUpdate(req.params.householdId, req.body, {
      new: true,
    }).populate('members').populate('createdBy');
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a household
router.delete('/:householdId', async (req, res) => {
  try {
    const household = await Household.findById(req.params.householdId);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    // Only creator can delete
    if (String(household.createdBy) !== String(req.user.roommateId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await Household.findByIdAndDelete(req.params.householdId);
    res.json({ message: 'Household deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

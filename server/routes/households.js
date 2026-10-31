const express = require('express');
const mongoose = require('mongoose');
const router = express.Router({ mergeParams: true });
const Household = require('../models/Household');
const HouseholdMembership = require('../models/HouseholdMembership');
const {
  requireHouseholdMembership,
  requireHouseholdRole,
} = require('../middleware/householdMembership');
const { newInvite, CODE_PATTERN } = require('../utils/inviteCode');

const PEOPLE_FIELDS = 'displayName email profilePicture';
const isId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

// Only owners see the invite code.
function present(household, role) {
  const data = household.toObject ? household.toObject() : { ...household };
  if (role !== 'owner') {
    delete data.code;
    delete data.codeExpiresAt;
  }
  return data;
}

// Create a household
router.post('/', async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 100) {
      return res.status(400).json({ error: 'A household name up to 100 characters is required' });
    }

    const household = await Household.create({
      name,
      createdBy: req.user.roommateId,
      members: [req.user.roommateId],
      ...newInvite(),
    });
    try {
      await HouseholdMembership.create({
        householdId: household._id,
        userId: req.user.roommateId,
        role: 'owner',
      });
    } catch (err) {
      await Household.deleteOne({ _id: household._id });
      throw err;
    }
    res.status(201).json(household);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all households for the current user
router.get('/', async (req, res) => {
  try {
    const households = await Household.find({ members: req.user.roommateId })
      .populate('members', PEOPLE_FIELDS)
      .populate('createdBy', PEOPLE_FIELDS)
      .sort({ createdAt: -1 });
    res.json(
      households.map((h) =>
        present(h, String(h.createdBy?._id || h.createdBy) === String(req.user.roommateId) ? 'owner' : 'member')
      )
    );
  } catch (err) {
    res.status(500).json({ error: 'Failed to load households' });
  }
});

// Join a household by invite code
router.post('/join/:code', async (req, res) => {
  const invalid = () => res.status(404).json({ error: 'Invalid or expired invite code' });
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!CODE_PATTERN.test(code)) return invalid();

    const household = await Household.findOne({ code, codeExpiresAt: { $gt: new Date() } });
    if (!household) return invalid();

    const userId = req.user.roommateId;
    try {
      await HouseholdMembership.updateOne(
        { householdId: household._id, userId },
        { $setOnInsert: { role: 'member' } },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
    await Household.updateOne({ _id: household._id }, { $addToSet: { members: userId } });

    const joined = await Household.findById(household._id)
      .populate('members', PEOPLE_FIELDS)
      .populate('createdBy', PEOPLE_FIELDS);
    res.json(present(joined, 'member'));
  } catch (err) {
    res.status(500).json({ error: 'Failed to join household' });
  }
});

// Get a specific household (members only)
router.get('/:householdId', requireHouseholdMembership, async (req, res) => {
  try {
    const household = await Household.findById(req.household._id)
      .populate('members', PEOPLE_FIELDS)
      .populate('createdBy', PEOPLE_FIELDS);
    res.json(present(household, req.householdMembership.role));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load household' });
  }
});

// Update a household (owner only)
router.put('/:householdId', requireHouseholdMembership, requireHouseholdRole('owner'), async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 100) {
      return res.status(400).json({ error: 'A household name up to 100 characters is required' });
    }
    const updated = await Household.findOneAndUpdate(
      { _id: req.household._id },
      { $set: { name } },
      { new: true, runValidators: true }
    )
      .populate('members', PEOPLE_FIELDS)
      .populate('createdBy', PEOPLE_FIELDS);
    res.json(present(updated, 'owner'));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a household (owner only). Memberships go with it.
router.delete('/:householdId', requireHouseholdMembership, requireHouseholdRole('owner'), async (req, res) => {
  try {
    await HouseholdMembership.deleteMany({ householdId: req.household._id });
    await Household.findOneAndDelete({ _id: req.household._id });
    res.json({ message: 'Household deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete household' });
  }
});

// Replace the invite code with a fresh one (owner only)
router.post('/:householdId/invite', requireHouseholdMembership, requireHouseholdRole('owner'), async (req, res) => {
  try {
    const invite = newInvite();
    await Household.updateOne({ _id: req.household._id }, { $set: invite });
    res.json(invite);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// Revoke the current invite code (owner only)
router.delete('/:householdId/invite', requireHouseholdMembership, requireHouseholdRole('owner'), async (req, res) => {
  try {
    await Household.updateOne({ _id: req.household._id }, { $set: { codeExpiresAt: new Date() } });
    res.json({ message: 'Invite revoked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke invite' });
  }
});

// Remove a member (owner) or leave (self). Never deletes the user's account.
router.delete('/:householdId/members/:userId', requireHouseholdMembership, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isId(userId) || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const isSelf = String(userId) === String(req.user.roommateId);
    if (!isSelf && req.householdMembership.role !== 'owner') {
      return res.status(403).json({ error: 'Insufficient household role' });
    }

    const target = await HouseholdMembership.findOne({
      householdId: req.household._id,
      userId,
      status: 'active',
    });
    if (!target) return res.status(404).json({ error: 'Member not found' });
    if (target.role === 'owner') {
      return res.status(400).json({ error: 'The owner cannot be removed. Delete the household instead.' });
    }

    await HouseholdMembership.deleteOne({ householdId: req.household._id, userId });
    await Household.updateOne({ _id: req.household._id }, { $pull: { members: userId } });
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

module.exports = router;

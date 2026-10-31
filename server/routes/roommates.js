// server/routes/roommates.js
const express = require('express');
const router = express.Router();
const Roommate = require('../models/Roommate');
const HouseholdMembership = require('../models/HouseholdMembership');

// Roommates are created at sign-in and edited only through /me.
// People listing is limited to users who share a household with the caller.
router.get('/', async (req, res) => {
  try {
    const mine = await HouseholdMembership.find({
      userId: req.user.roommateId,
      status: 'active',
    }).select('householdId');
    const shared = await HouseholdMembership.find({
      householdId: { $in: mine.map((m) => m.householdId) },
      status: 'active',
    }).select('userId');
    const ids = [...new Set(shared.map((m) => String(m.userId)))].filter(
      (userId) => userId !== String(req.user.roommateId)
    );
    const roommates = await Roommate.find({ _id: { $in: ids } })
      .select('displayName email profilePicture bio')
      .sort({ createdAt: -1 });
    res.json(roommates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load roommates' });
  }
});

// Get current user's profile
router.get('/me', async (req, res) => {
  try {
    const roommate = await Roommate.findById(req.user.roommateId);
    if (!roommate) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(roommate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update current user's profile
router.put('/me', async (req, res) => {
  try {
    const { displayName, bio, profilePicture } = req.body;
    
    // Build update object with only allowed fields
    const updateFields = {};
    if (displayName !== undefined) {
      updateFields.displayName = String(displayName).trim().substring(0, 50);
    }
    if (bio !== undefined) {
      updateFields.bio = String(bio).trim().substring(0, 500);
    }
    if (profilePicture !== undefined) {
      updateFields.profilePicture = String(profilePicture).trim();
    }
    
    const updated = await Roommate.findByIdAndUpdate(
      req.user.roommateId,
      updateFields,
      { new: true, runValidators: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

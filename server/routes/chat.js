// server/routes/chat.js
const express = require('express');
const router = express.Router({ mergeParams: true });
const ChatMessage = require('../models/ChatMessage');
const Household = require('../models/Household');

async function ensureHouseholdMember(req, res, next) {
  const householdId = req.params.householdId;
  const household = await Household.findById(householdId);
  if (!household) return res.status(404).json({ error: 'Household not found' });

  const isMember = household.members.some(
    (m) => String(m) === String(req.user.roommateId)
  );
  if (!isMember) return res.status(403).json({ error: 'Not a member of this household' });

  next();
}

// GET messages for a household
router.get('/:householdId/chat', ensureHouseholdMember, async (req, res) => {
  try {
    const messages = await ChatMessage.find({
      $or: [
        { householdId: req.params.householdId },
        { roomId: req.params.householdId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate('sender')
      .lean();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new message
router.post('/:householdId/chat', ensureHouseholdMember, async (req, res) => {
  try {
    const { text, relatedType, relatedId } = req.body;
    const msg = await ChatMessage.create({
      householdId: req.params.householdId,
      sender: req.user.roommateId,
      text,
      relatedType: relatedType || null,
      relatedId: relatedId || null,
    });
    const populated = await msg.populate('sender');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

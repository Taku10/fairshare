const express = require('express');
const ChatMessage = require('../models/ChatMessage');
const Chore = require('../models/Chore');
const Expense = require('../models/Expense');
const { requireHouseholdMembership } = require('../middleware/householdMembership');

// Mounted at /api/households/:householdId/messages
const router = express.Router({ mergeParams: true });

const OBJECT_ID = /^[a-f\d]{24}$/i;
const RELATED_MODELS = { chore: Chore, expense: Expense };
const MAX_TEXT = 2000;

router.use(requireHouseholdMembership);

router.get('/', async (req, res) => {
  try {
    // Legacy messages may only carry roomId, which holds this same household's ID.
    const messages = await ChatMessage.find({
      $or: [{ householdId: req.household._id }, { roomId: req.household._id }],
    })
      .sort({ createdAt: 1 })
      .populate('sender', 'displayName profilePicture')
      .lean();
    res.json(messages);
  } catch {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { text, relatedType, relatedId } = req.body;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    let related = { relatedType: null, relatedId: null };
    if (relatedType || relatedId) {
      const Model = RELATED_MODELS[relatedType];
      if (!Model || typeof relatedId !== 'string' || !OBJECT_ID.test(relatedId)) {
        return res.status(400).json({ error: 'Invalid related item' });
      }
      const exists = await Model.findOne({ _id: relatedId, householdId: req.household._id });
      if (!exists) return res.status(400).json({ error: 'Invalid related item' });
      related = { relatedType, relatedId };
    }

    const message = await ChatMessage.create({
      householdId: req.household._id,
      sender: req.user.roommateId,
      text: text.trim().substring(0, MAX_TEXT),
      ...related,
    });
    const populated = await message.populate('sender', 'displayName profilePicture');
    res.status(201).json(populated);
  } catch (err) {
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid message' });
    }
    res.status(500).json({ error: 'Failed to create message' });
  }
});

module.exports = router;

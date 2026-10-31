const mongoose = require('mongoose');
const Household = require('../models/Household');
const HouseholdMembership = require('../models/HouseholdMembership');
const ChatMessage = require('../models/ChatMessage');

const MAX_TEXT = 2000;
const OBJECT_ID = /^[a-f\d]{24}$/i;
const RELATED_TYPES = ['chore', 'expense'];

// Every failure uses the same message so a guessed ID reveals nothing about other households.
const DENIED = 'Household not found';

async function authorizeSocketHousehold(socket, householdId) {
  if (
    typeof householdId !== 'string' ||
    !OBJECT_ID.test(householdId) ||
    !mongoose.isValidObjectId(householdId)
  ) {
    throw new Error(DENIED);
  }

  const household = await Household.findById(householdId);
  if (!household) throw new Error(DENIED);

  const membership = await HouseholdMembership.findOne({
    householdId,
    userId: socket.user.roommateId,
    status: 'active',
  });
  if (!membership) throw new Error(DENIED);

  return household;
}

function registerChatHandlers(io, socket) {
  socket.on('joinHousehold', async (householdId) => {
    try {
      const household = await authorizeSocketHousehold(socket, householdId);
      socket.join(String(household._id));
    } catch (err) {
      socket.emit('errorMessage', err.message === DENIED ? DENIED : 'Failed to join household');
    }
  });

  socket.on('sendMessage', async (payload) => {
    try {
      const { householdId, text, relatedType, relatedId } = payload || {};
      if (typeof text !== 'string' || !text.trim()) return;

      const household = await authorizeSocketHousehold(socket, householdId);

      const hasRelated = relatedType || relatedId;
      if (
        hasRelated &&
        (!RELATED_TYPES.includes(relatedType) ||
          typeof relatedId !== 'string' ||
          !OBJECT_ID.test(relatedId))
      ) {
        socket.emit('errorMessage', 'Invalid related item');
        return;
      }

      const message = await ChatMessage.create({
        householdId: household._id,
        sender: socket.user.roommateId,
        text: text.trim().substring(0, MAX_TEXT),
        relatedType: hasRelated ? relatedType : null,
        relatedId: hasRelated ? relatedId : null,
      });
      const populated = await message.populate('sender');

      io.to(String(household._id)).emit('chatMessage', populated);
    } catch (err) {
      socket.emit('errorMessage', err.message === DENIED ? DENIED : 'Failed to send message');
    }
  });
}

module.exports = { authorizeSocketHousehold, registerChatHandlers };

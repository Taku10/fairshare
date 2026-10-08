const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const getOrCreateDefaultHouseholdFor = require('../utils/defaultHousehold');

// Get all events
router.get('/', async (req, res) => {
  try {
    const events = await Event.find()
      .populate('createdBy', 'name color')
      .populate('attendees', 'name color')
      .sort({ startDate: 1 });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get events by date range
router.get('/range', async (req, res) => {
  try {
    const { start, end } = req.query;
    const query = {};
    
    if (start && end) {
      query.startDate = {
        $gte: new Date(start),
        $lte: new Date(end)
      };
    }
    
    const events = await Event.find(query)
      .populate('createdBy', 'name color')
      .populate('attendees', 'name color')
      .sort({ startDate: 1 });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get upcoming events
router.get('/upcoming', async (req, res) => {
  try {
    const now = new Date();
    const events = await Event.find({ 
      startDate: { $gte: now }
    })
      .populate('createdBy', 'name color')
      .populate('attendees', 'name color')
      .sort({ startDate: 1 })
      .limit(10);
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch upcoming events' });
  }
});

// Get unpaid bills
router.get('/bills/unpaid', async (req, res) => {
  try {
    const bills = await Event.find({ 
      eventType: 'bill',
      isPaid: false
    })
      .populate('createdBy', 'name color')
      .sort({ startDate: 1 });
    res.json(bills);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch unpaid bills' });
  }
});

// Create a new event
router.post('/', async (req, res) => {
  try {
    const householdId = req.body.householdId || (await getOrCreateDefaultHouseholdFor(req.user.roommateId))._id;
    const event = new Event({
      ...req.body,
      householdId,
      createdBy: req.user.roommateId
    });
    await event.save();
    const populated = await Event.findById(event._id)
      .populate('createdBy', 'name color')
      .populate('attendees', 'name color');
    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to create event' });
  }
});

// Update an event
router.put('/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    )
      .populate('createdBy', 'name color')
      .populate('attendees', 'name color');
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to update event' });
  }
});

// Mark bill as paid
router.patch('/:id/pay', async (req, res) => {
  try {
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, eventType: 'bill' },
      { isPaid: true, updatedAt: Date.now() },
      { new: true }
    )
      .populate('createdBy', 'name color')
      .populate('attendees', 'name color');
    
    if (!event) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to mark bill as paid' });
  }
});

// Delete an event
router.delete('/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;

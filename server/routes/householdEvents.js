const express = require('express');
const Event = require('../models/Event');
const HouseholdMembership = require('../models/HouseholdMembership');
const { requireHouseholdMembership } = require('../middleware/householdMembership');

// Mounted at /api/households/:householdId/events
const router = express.Router({ mergeParams: true });

const OBJECT_ID = /^[a-f\d]{24}$/i;
const EVENT_TYPES = ['party', 'guest', 'maintenance', 'bill', 'other'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];
const MAX_ATTENDEES = 50;
const USER_FIELDS = 'displayName profilePicture';

router.use(requireHouseholdMembership);

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function parseText(value, label, max, { required = false } = {}) {
  if (typeof value !== 'string') throw badRequest(`${label} must be a string`);
  const text = value.trim().substring(0, max);
  if (required && !text) throw badRequest(`${label} is required`);
  return text;
}

function parseDate(value, label) {
  const date = new Date(value);
  if (typeof value === 'object' || Number.isNaN(date.getTime())) {
    throw badRequest(`Invalid ${label}`);
  }
  return date;
}

async function parseAttendees(householdId, value) {
  if (!Array.isArray(value)) throw badRequest('attendees must be an array');
  const ids = Array.from(
    new Set(
      value.map((entry) => {
        if (typeof entry !== 'string' || !OBJECT_ID.test(entry)) {
          throw badRequest('Invalid attendee ID');
        }
        return entry;
      })
    )
  );
  if (ids.length > MAX_ATTENDEES) throw badRequest('Too many attendees');

  const results = await Promise.all(
    ids.map((userId) => HouseholdMembership.findOne({ householdId, userId, status: 'active' }))
  );
  if (results.some((membership) => !membership)) {
    throw badRequest('Attendees must belong to this household');
  }
  return ids;
}

// Builds a validated field set from the allowlist; anything else in the body is ignored.
async function buildEventFields(householdId, body, { creating }) {
  const fields = {};

  if (creating || body.title !== undefined) {
    fields.title = parseText(body.title ?? '', 'Title', 100, { required: true });
  }
  if (body.description !== undefined) {
    fields.description = parseText(body.description, 'Description', 1000);
  }
  if (body.location !== undefined) {
    fields.location = parseText(body.location, 'Location', 200);
  }
  if (body.eventType !== undefined) {
    if (!EVENT_TYPES.includes(body.eventType)) throw badRequest('Invalid eventType');
    fields.eventType = body.eventType;
  }
  if (creating || body.startDate !== undefined) {
    if (body.startDate === undefined) throw badRequest('startDate is required');
    fields.startDate = parseDate(body.startDate, 'startDate');
  }
  if (body.endDate !== undefined) {
    fields.endDate = body.endDate === null ? null : parseDate(body.endDate, 'endDate');
  }
  if (body.allDay !== undefined) fields.allDay = Boolean(body.allDay);
  if (body.billAmount !== undefined) {
    const amount = Number(body.billAmount);
    if (body.billAmount === null) fields.billAmount = null;
    else if (!Number.isFinite(amount) || amount < 0) throw badRequest('Invalid billAmount');
    else fields.billAmount = amount;
  }
  if (body.recurring !== undefined) {
    const recurring = body.recurring || {};
    if (recurring.frequency !== undefined && !FREQUENCIES.includes(recurring.frequency)) {
      throw badRequest('Invalid recurring frequency');
    }
    fields.recurring = {
      enabled: Boolean(recurring.enabled),
      ...(recurring.frequency !== undefined ? { frequency: recurring.frequency } : {}),
    };
  }
  if (body.attendees !== undefined) {
    fields.attendees = await parseAttendees(householdId, body.attendees);
  }

  return fields;
}

function handleError(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid event data' });
  }
  return res.status(500).json({ error: fallback });
}

function validEventId(req, res) {
  if (!OBJECT_ID.test(req.params.eventId || '')) {
    res.status(400).json({ error: 'Invalid event ID' });
    return false;
  }
  return true;
}

function withPeople(q) {
  return q.populate('createdBy', USER_FIELDS).populate('attendees', USER_FIELDS);
}

router.get('/', async (req, res) => {
  try {
    const events = await withPeople(
      Event.find({ householdId: req.household._id }).sort({ startDate: 1 })
    );
    res.json(events);
  } catch (err) {
    handleError(res, err, 'Failed to fetch events');
  }
});

// Fixed paths are declared before '/:eventId' so they are not treated as IDs.
router.get('/range', async (req, res) => {
  try {
    const filter = { householdId: req.household._id };
    if (req.query.start && req.query.end) {
      filter.startDate = {
        $gte: parseDate(String(req.query.start), 'start'),
        $lte: parseDate(String(req.query.end), 'end'),
      };
    }
    res.json(await withPeople(Event.find(filter).sort({ startDate: 1 })));
  } catch (err) {
    handleError(res, err, 'Failed to fetch events');
  }
});

router.get('/upcoming', async (req, res) => {
  try {
    const events = await withPeople(
      Event.find({ householdId: req.household._id, startDate: { $gte: new Date() } })
        .sort({ startDate: 1 })
        .limit(10)
    );
    res.json(events);
  } catch (err) {
    handleError(res, err, 'Failed to fetch upcoming events');
  }
});

router.get('/bills/unpaid', async (req, res) => {
  try {
    const bills = await Event.find({
      householdId: req.household._id,
      eventType: 'bill',
      isPaid: false,
    })
      .populate('createdBy', USER_FIELDS)
      .sort({ startDate: 1 });
    res.json(bills);
  } catch (err) {
    handleError(res, err, 'Failed to fetch unpaid bills');
  }
});

router.get('/:eventId', async (req, res) => {
  if (!validEventId(req, res)) return;
  try {
    const event = await withPeople(
      Event.findOne({ _id: req.params.eventId, householdId: req.household._id })
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    handleError(res, err, 'Failed to fetch event');
  }
});

router.post('/', async (req, res) => {
  try {
    const fields = await buildEventFields(req.household._id, req.body, { creating: true });
    const event = await Event.create({
      ...fields,
      householdId: req.household._id,
      createdBy: req.user.roommateId,
    });
    const populated = await withPeople(
      Event.findOne({ _id: event._id, householdId: req.household._id })
    );
    res.status(201).json(populated);
  } catch (err) {
    handleError(res, err, 'Failed to create event');
  }
});

router.put('/:eventId', async (req, res) => {
  if (!validEventId(req, res)) return;
  try {
    const updates = await buildEventFields(req.household._id, req.body, { creating: false });

    // householdId, createdBy, isPaid and every other field in the body are intentionally ignored.
    const event = await withPeople(
      Event.findOneAndUpdate(
        { _id: req.params.eventId, householdId: req.household._id },
        { $set: updates },
        { new: true, runValidators: true }
      )
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    handleError(res, err, 'Failed to update event');
  }
});

router.patch('/:eventId/pay', async (req, res) => {
  if (!validEventId(req, res)) return;
  try {
    const event = await withPeople(
      Event.findOneAndUpdate(
        { _id: req.params.eventId, householdId: req.household._id, eventType: 'bill' },
        { $set: { isPaid: true } },
        { new: true }
      )
    );
    if (!event) return res.status(404).json({ error: 'Bill not found' });
    res.json(event);
  } catch (err) {
    handleError(res, err, 'Failed to mark bill as paid');
  }
});

router.delete('/:eventId', async (req, res) => {
  if (!validEventId(req, res)) return;
  try {
    const deleted = await Event.findOneAndDelete({
      _id: req.params.eventId,
      householdId: req.household._id,
    });
    if (!deleted) return res.status(404).json({ error: 'Event not found' });
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    handleError(res, err, 'Failed to delete event');
  }
});

module.exports = router;

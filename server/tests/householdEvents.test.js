const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Household = require('../models/Household');
const HouseholdMembership = require('../models/HouseholdMembership');
const householdEventsRouter = require('../routes/householdEvents');

const id = () => new mongoose.Types.ObjectId();
const userA = id();
const userA2 = id();
const userB = id();
const householdA = id();
const householdB = id();

function matches(doc, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === 'object' && !(value instanceof mongoose.Types.ObjectId)) {
      if ('$gte' in value) return new Date(doc[key]) >= value.$gte && new Date(doc[key]) <= value.$lte;
      return true;
    }
    return String(doc[key]) === String(value);
  });
}

function query(resolve) {
  const q = {
    sort: () => q,
    limit: () => q,
    populate: () => q,
    then: (onFulfilled, onRejected) => Promise.resolve().then(resolve).then(onFulfilled, onRejected),
  };
  return q;
}

function setup(t) {
  const events = [];
  const memberships = [
    { householdId: householdA, userId: userA, role: 'owner', status: 'active' },
    { householdId: householdA, userId: userA2, role: 'member', status: 'active' },
    { householdId: householdB, userId: userB, role: 'owner', status: 'active' },
  ];
  const households = [{ _id: householdA }, { _id: householdB }];

  t.mock.method(Household, 'findById', async (hid) =>
    households.find((h) => String(h._id) === String(hid)) || null
  );
  t.mock.method(HouseholdMembership, 'findOne', async (filter) =>
    memberships.find((m) => matches(m, filter)) || null
  );
  t.mock.method(Event, 'find', (filter) => query(() => events.filter((e) => matches(e, filter))));
  t.mock.method(Event, 'findOne', (filter) =>
    query(() => events.find((e) => matches(e, filter)) || null)
  );
  t.mock.method(Event, 'create', async (doc) => {
    const event = { _id: id(), isPaid: false, ...doc };
    events.push(event);
    return event;
  });
  t.mock.method(Event, 'findOneAndUpdate', (filter, update) =>
    query(() => {
      const event = events.find((e) => matches(e, filter));
      if (event) Object.assign(event, update.$set);
      return event || null;
    })
  );
  t.mock.method(Event, 'findOneAndDelete', async (filter) => {
    const index = events.findIndex((e) => matches(e, filter));
    return index === -1 ? null : events.splice(index, 1)[0];
  });

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const user = req.headers['x-user'];
    if (user) req.user = { roommateId: user };
    next();
  });
  app.use('/api/households/:householdId/events', householdEventsRouter);

  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      t.after(() => server.close());
      const call = async (method, path, user, body) => {
        const res = await fetch(base + path, {
          method,
          headers: { 'content-type': 'application/json', ...(user ? { 'x-user': String(user) } : {}) },
          body: body ? JSON.stringify(body) : undefined,
        });
        return { status: res.status, body: await res.json() };
      };
      resolve({ events, call });
    });
  });
}

const base = (hid) => `/api/households/${hid}/events`;
const party = (extra = {}) => ({ title: 'Party', startDate: '2030-01-01T18:00:00.000Z', ...extra });

test('requires authentication', async (t) => {
  const { call } = await setup(t);
  assert.equal((await call('GET', base(householdA), null)).status, 401);
});

test('members can create, list, read, update, pay, and delete in their own household', async (t) => {
  const { call } = await setup(t);

  const created = await call('POST', base(householdA), userA, party({ attendees: [String(userA2)] }));
  assert.equal(created.status, 201);
  assert.equal(String(created.body.householdId), String(householdA));
  assert.equal(String(created.body.createdBy), String(userA));

  const eventId = created.body._id;
  assert.equal((await call('GET', base(householdA), userA2)).body.length, 1);
  assert.equal((await call('GET', `${base(householdA)}/${eventId}`, userA)).status, 200);

  const updated = await call('PUT', `${base(householdA)}/${eventId}`, userA, { title: 'Renamed' });
  assert.equal(updated.body.title, 'Renamed');

  assert.equal((await call('PATCH', `${base(householdA)}/${eventId}/pay`, userA)).status, 404);
  const bill = await call('POST', base(householdA), userA, party({ eventType: 'bill', billAmount: 50 }));
  const paid = await call('PATCH', `${base(householdA)}/${bill.body._id}/pay`, userA);
  assert.equal(paid.body.isPaid, true);

  assert.equal((await call('DELETE', `${base(householdA)}/${eventId}`, userA)).status, 200);
});

test('fixed paths are not mistaken for event IDs', async (t) => {
  const { call } = await setup(t);
  await call('POST', base(householdA), userA, party({ eventType: 'bill' }));
  assert.equal((await call('GET', `${base(householdA)}/upcoming`, userA)).status, 200);
  assert.equal((await call('GET', `${base(householdA)}/bills/unpaid`, userA)).body.length, 1);
  const range = await call(
    'GET',
    `${base(householdA)}/range?start=2029-01-01&end=2031-01-01`,
    userA
  );
  assert.equal(range.body.length, 1);
});

test('a user cannot list, read, create, update, pay, or delete in another household', async (t) => {
  const { call, events } = await setup(t);
  const own = await call('POST', base(householdB), userB, party({ eventType: 'bill' }));
  const eventId = own.body._id;

  assert.equal((await call('GET', base(householdB), userA)).status, 404);
  assert.equal((await call('GET', `${base(householdB)}/${eventId}`, userA)).status, 404);
  assert.equal((await call('GET', `${base(householdB)}/upcoming`, userA)).status, 404);
  assert.equal((await call('GET', `${base(householdB)}/bills/unpaid`, userA)).status, 404);
  assert.equal((await call('POST', base(householdB), userA, party())).status, 404);
  assert.equal((await call('PUT', `${base(householdB)}/${eventId}`, userA, { title: 'x' })).status, 404);
  assert.equal((await call('PATCH', `${base(householdB)}/${eventId}/pay`, userA)).status, 404);
  assert.equal((await call('DELETE', `${base(householdB)}/${eventId}`, userA)).status, 404);

  assert.equal(events.length, 1);
  assert.equal(events[0].title, 'Party');
  assert.equal(events[0].isPaid, false);
});

test('an event ID from another household is not reachable through your own household', async (t) => {
  const { call, events } = await setup(t);
  const foreign = await call('POST', base(householdB), userB, party({ eventType: 'bill' }));
  const eventId = foreign.body._id;

  assert.equal((await call('GET', `${base(householdA)}/${eventId}`, userA)).status, 404);
  assert.equal((await call('PUT', `${base(householdA)}/${eventId}`, userA, { title: 'x' })).status, 404);
  assert.equal((await call('PATCH', `${base(householdA)}/${eventId}/pay`, userA)).status, 404);
  assert.equal((await call('DELETE', `${base(householdA)}/${eventId}`, userA)).status, 404);
  assert.equal(events.length, 1);
  assert.equal(events[0].isPaid, false);
});

test('list and unpaid bills only return the household events', async (t) => {
  const { call } = await setup(t);
  await call('POST', base(householdA), userA, party({ title: 'A bill', eventType: 'bill' }));
  await call('POST', base(householdB), userB, party({ title: 'B bill', eventType: 'bill' }));

  assert.deepEqual((await call('GET', base(householdA), userA)).body.map((e) => e.title), ['A bill']);
  assert.deepEqual(
    (await call('GET', `${base(householdA)}/bills/unpaid`, userA)).body.map((e) => e.title),
    ['A bill']
  );
});

test('protects householdId, createdBy, and isPaid from client input', async (t) => {
  const { call, events } = await setup(t);
  const created = await call('POST', base(householdA), userA, party({
    householdId: String(householdB),
    createdBy: String(userB),
    isPaid: true,
  }));
  assert.equal(String(created.body.householdId), String(householdA));
  assert.equal(String(created.body.createdBy), String(userA));
  assert.equal(created.body.isPaid, false);

  await call('PUT', `${base(householdA)}/${created.body._id}`, userA, {
    householdId: String(householdB),
    createdBy: String(userB),
    isPaid: true,
    title: 'Renamed',
  });
  assert.equal(String(events[0].householdId), String(householdA));
  assert.equal(String(events[0].createdBy), String(userA));
  assert.equal(events[0].isPaid, false);
  assert.equal(events[0].title, 'Renamed');
});

test('rejects attendees who are not members of the household', async (t) => {
  const { call, events } = await setup(t);

  assert.equal((await call('POST', base(householdA), userA, party({ attendees: [String(userB)] }))).status, 400);
  assert.equal(events.length, 0);

  const ok = await call('POST', base(householdA), userA, party());
  const update = await call('PUT', `${base(householdA)}/${ok.body._id}`, userA, { attendees: [String(userB)] });
  assert.equal(update.status, 400);
  assert.equal(events[0].attendees, undefined);
});

test('validates IDs and fields', async (t) => {
  const { call } = await setup(t);
  assert.equal((await call('GET', base('not-an-id'), userA)).status, 400);
  assert.equal((await call('GET', `${base(householdA)}/nope`, userA)).status, 400);
  assert.equal((await call('POST', base(householdA), userA, { startDate: '2030-01-01' })).status, 400);
  assert.equal((await call('POST', base(householdA), userA, { title: 'x' })).status, 400);
  assert.equal((await call('POST', base(householdA), userA, party({ startDate: 'garbage' }))).status, 400);
  assert.equal((await call('POST', base(householdA), userA, party({ eventType: 'nope' }))).status, 400);
  assert.equal((await call('POST', base(householdA), userA, party({ attendees: ['nope'] }))).status, 400);
});

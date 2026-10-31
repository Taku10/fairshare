const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const Chore = require('../models/Chore');
const Household = require('../models/Household');
const HouseholdMembership = require('../models/HouseholdMembership');
const householdChoresRouter = require('../routes/householdChores');

const id = () => new mongoose.Types.ObjectId();
const userA = id();
const userA2 = id();
const userB = id();
const householdA = id();
const householdB = id();

function matches(doc, filter) {
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

function query(resolve) {
  const q = {
    sort: () => q,
    populate: () => q,
    then: (onFulfilled, onRejected) => Promise.resolve().then(resolve).then(onFulfilled, onRejected),
  };
  return q;
}

function setup(t) {
  const chores = [];
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
  t.mock.method(Chore, 'find', (filter) => query(() => chores.filter((c) => matches(c, filter))));
  t.mock.method(Chore, 'findOne', (filter) =>
    query(() => chores.find((c) => matches(c, filter)) || null)
  );
  t.mock.method(Chore, 'create', async (doc) => {
    const chore = { _id: id(), completed: false, ...doc };
    chores.push(chore);
    return chore;
  });
  t.mock.method(Chore, 'findOneAndUpdate', (filter, update) =>
    query(() => {
      const chore = chores.find((c) => matches(c, filter));
      if (chore) Object.assign(chore, update.$set);
      return chore || null;
    })
  );
  t.mock.method(Chore, 'findOneAndDelete', async (filter) => {
    const index = chores.findIndex((c) => matches(c, filter));
    return index === -1 ? null : chores.splice(index, 1)[0];
  });

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const user = req.headers['x-user'];
    if (user) req.user = { roommateId: user };
    next();
  });
  app.use('/api/households/:householdId/chores', householdChoresRouter);

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
      resolve({ chores, call });
    });
  });
}

const base = (hid) => `/api/households/${hid}/chores`;

test('requires authentication', async (t) => {
  const { call } = await setup(t);
  const res = await call('GET', base(householdA), null);
  assert.equal(res.status, 401);
});

test('members can create, list, read, update, and delete in their own household', async (t) => {
  const { call } = await setup(t);

  const created = await call('POST', base(householdA), userA, { title: 'Dishes', assignedTo: String(userA2) });
  assert.equal(created.status, 201);
  assert.equal(String(created.body.householdId), String(householdA));

  const choreId = created.body._id;
  assert.equal((await call('GET', base(householdA), userA2)).body.length, 1);
  assert.equal((await call('GET', `${base(householdA)}/${choreId}`, userA)).status, 200);

  const updated = await call('PUT', `${base(householdA)}/${choreId}`, userA, { completed: true });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.completed, true);

  assert.equal((await call('DELETE', `${base(householdA)}/${choreId}`, userA)).status, 200);
  assert.equal((await call('GET', base(householdA), userA)).body.length, 0);
});

test('a user cannot list, read, create, update, or delete in another household', async (t) => {
  const { call, chores } = await setup(t);
  const own = await call('POST', base(householdB), userB, { title: 'Bins' });
  const choreId = own.body._id;

  assert.equal((await call('GET', base(householdB), userA)).status, 404);
  assert.equal((await call('GET', `${base(householdB)}/${choreId}`, userA)).status, 404);
  assert.equal((await call('POST', base(householdB), userA, { title: 'Intruder' })).status, 404);
  assert.equal((await call('PUT', `${base(householdB)}/${choreId}`, userA, { title: 'Hacked' })).status, 404);
  assert.equal((await call('DELETE', `${base(householdB)}/${choreId}`, userA)).status, 404);

  assert.equal(chores.length, 1);
  assert.equal(chores[0].title, 'Bins');
});

test('a chore ID from another household is not reachable through your own household', async (t) => {
  const { call, chores } = await setup(t);
  const foreign = await call('POST', base(householdB), userB, { title: 'Bins' });
  const choreId = foreign.body._id;

  assert.equal((await call('GET', `${base(householdA)}/${choreId}`, userA)).status, 404);
  assert.equal((await call('PUT', `${base(householdA)}/${choreId}`, userA, { title: 'Hacked' })).status, 404);
  assert.equal((await call('DELETE', `${base(householdA)}/${choreId}`, userA)).status, 404);
  assert.equal(chores.length, 1);
  assert.equal(chores[0].title, 'Bins');
});

test('list only returns the household chores', async (t) => {
  const { call } = await setup(t);
  await call('POST', base(householdA), userA, { title: 'A chore' });
  await call('POST', base(householdB), userB, { title: 'B chore' });

  const res = await call('GET', base(householdA), userA);
  assert.deepEqual(res.body.map((c) => c.title), ['A chore']);
});

test('ignores a client-provided householdId on create and cannot move a chore on update', async (t) => {
  const { call, chores } = await setup(t);
  const created = await call('POST', base(householdA), userA, {
    title: 'Dishes',
    householdId: String(householdB),
  });
  assert.equal(String(created.body.householdId), String(householdA));

  const updated = await call('PUT', `${base(householdA)}/${created.body._id}`, userA, {
    householdId: String(householdB),
    title: 'Renamed',
  });
  assert.equal(updated.status, 200);
  assert.equal(String(chores[0].householdId), String(householdA));
  assert.equal(chores[0].title, 'Renamed');
});

test('rejects assignees who are not members of the household', async (t) => {
  const { call, chores } = await setup(t);

  const create = await call('POST', base(householdA), userA, { title: 'Dishes', assignedTo: String(userB) });
  assert.equal(create.status, 400);
  assert.equal(chores.length, 0);

  const ok = await call('POST', base(householdA), userA, { title: 'Dishes' });
  const update = await call('PUT', `${base(householdA)}/${ok.body._id}`, userA, { assignedTo: String(userB) });
  assert.equal(update.status, 400);
  assert.equal(chores[0].assignedTo, undefined);
});

test('validates IDs and required fields', async (t) => {
  const { call } = await setup(t);
  assert.equal((await call('GET', base('not-an-id'), userA)).status, 400);
  assert.equal((await call('GET', `${base(householdA)}/nope`, userA)).status, 400);
  assert.equal((await call('POST', base(householdA), userA, { title: '   ' })).status, 400);
  assert.equal((await call('POST', base(householdA), userA, { title: 'x', assignedTo: 'nope' })).status, 400);
});

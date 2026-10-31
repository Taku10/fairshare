const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const { migrate, formatReport } = require('../utils/householdMigration');
const choresRouter = require('../routes/chores');
const expensesRouter = require('../routes/expenses');
const eventsRouter = require('../routes/events');

const id = () => String(new mongoose.Types.ObjectId());
const dest = id();
const other = id();
const ownerId = id();
const memberId = id();

function makeStore() {
  const data = {
    households: [
      { _id: dest, createdBy: ownerId, members: [ownerId, memberId] },
      { _id: other, createdBy: memberId, members: [memberId] },
    ],
    memberships: [{ householdId: dest, userId: ownerId, role: 'owner' }],
    chores: [{ _id: id() }, { _id: id(), householdId: other }],
    expenses: [{ _id: id() }],
    events: [{ _id: id() }, { _id: id(), householdId: null }],
    chatMessages: [{ _id: id(), roomId: other }, { _id: id() }],
  };
  const unowned = (d) => !d.householdId;
  const store = {
    data,
    writes: 0,
    householdExists: async (hid) => data.households.some((h) => h._id === String(hid)),
    listHouseholds: async () => data.households,
    hasMembership: async (h, u) => data.memberships.some((m) => m.householdId === h && m.userId === u),
    addMembership: async (householdId, userId, role) => {
      store.writes += 1;
      data.memberships.push({ householdId, userId, role });
    },
    countOwned: async (name) => data[name].filter((d) => !unowned(d)).length,
    findUnowned: async (name) => data[name].filter(unowned),
    setHousehold: async (name, _id, householdId) => {
      const doc = data[name].find((d) => d._id === _id);
      if (!doc || !unowned(doc)) return false;
      store.writes += 1;
      doc.householdId = householdId;
      return true;
    },
  };
  return store;
}

test('requires a valid, existing destination household', async () => {
  const store = makeStore();
  await assert.rejects(migrate({ store }), /destination household ID is required/);
  await assert.rejects(migrate({ store, destinationHouseholdId: 'nope' }), /required/);
  await assert.rejects(migrate({ store, destinationHouseholdId: id() }), /does not exist/);
  assert.equal(store.writes, 0);
});

test('dry run reports what would change and writes nothing', async () => {
  const store = makeStore();
  const report = await migrate({ store, destinationHouseholdId: dest });

  assert.equal(report.mode, 'dry-run');
  assert.equal(store.writes, 0);
  assert.equal(report.records.chores.updated, 1);
  assert.equal(report.records.chores.skipped, 1);
  assert.equal(report.records.events.updated, 2);
  assert.equal(report.memberships.updated, 2);
  assert.equal(report.memberships.skipped, 1);
  assert.equal(store.data.chores[0].householdId, undefined);
  assert.match(formatReport(report), /would update/);
});

test('apply assigns the destination, keeps existing owners, and honors chat roomId', async () => {
  const store = makeStore();
  const report = await migrate({ store, destinationHouseholdId: dest, apply: true });

  assert.equal(report.mode, 'apply');
  assert.equal(store.data.chores[0].householdId, dest);
  assert.equal(store.data.chores[1].householdId, other);
  assert.equal(store.data.expenses[0].householdId, dest);
  assert.equal(store.data.events.every((e) => e.householdId === dest), true);
  assert.equal(store.data.chatMessages[0].householdId, other);
  assert.equal(store.data.chatMessages[1].householdId, dest);
  assert.equal(report.errors.length, 0);
});

test('backfills memberships with the right roles', async () => {
  const store = makeStore();
  await migrate({ store, destinationHouseholdId: dest, apply: true });
  const role = (h, u) => store.data.memberships.find((m) => m.householdId === h && m.userId === u)?.role;
  assert.equal(role(dest, ownerId), 'owner');
  assert.equal(role(dest, memberId), 'member');
  assert.equal(role(other, memberId), 'owner');
  assert.equal(store.data.memberships.length, 3);
});

test('is safe to run twice', async () => {
  const store = makeStore();
  await migrate({ store, destinationHouseholdId: dest, apply: true });
  const writes = store.writes;
  const second = await migrate({ store, destinationHouseholdId: dest, apply: true });

  assert.equal(store.writes, writes);
  assert.equal(second.memberships.updated, 0);
  for (const counts of Object.values(second.records)) {
    assert.equal(counts.updated, 0);
    assert.equal(counts.found, 0);
  }
});

test('a chat message pointing at a missing household fails instead of being guessed', async () => {
  const store = makeStore();
  const ghost = id();
  store.data.chatMessages.push({ _id: id(), roomId: ghost });
  const report = await migrate({ store, destinationHouseholdId: dest, apply: true });

  assert.equal(report.records.chatMessages.failed, 1);
  assert.equal(store.data.chatMessages[2].householdId, undefined);
  assert.match(report.errors[0], /does not match an existing household/);
});

test('one failing record does not stop the others', async () => {
  const store = makeStore();
  const original = store.setHousehold;
  store.setHousehold = async (name, _id, h) => {
    if (name === 'expenses') throw new Error('boom');
    return original(name, _id, h);
  };
  const report = await migrate({ store, destinationHouseholdId: dest, apply: true });
  assert.equal(report.records.expenses.failed, 1);
  assert.equal(report.records.events.updated, 2);
});

test('a record claimed by another run mid-migration is skipped, not overwritten', async () => {
  const store = makeStore();
  const original = store.setHousehold;
  store.setHousehold = async (name, _id, h) => {
    if (name === 'expenses') {
      store.data.expenses[0].householdId = other;
      return false;
    }
    return original(name, _id, h);
  };
  const report = await migrate({ store, destinationHouseholdId: dest, apply: true });
  assert.equal(store.data.expenses[0].householdId, other);
  assert.equal(report.records.expenses.updated, 0);
  assert.equal(report.records.expenses.skipped, 1);
});

test('legacy create routes no longer assign a default household', async (t) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { roommateId: ownerId };
    next();
  });
  app.use('/chores', choresRouter);
  app.use('/expenses', expensesRouter);
  app.use('/events', eventsRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  for (const [path, body] of [
    ['/chores', { title: 'Dishes' }],
    ['/expenses', { description: 'Milk', amount: 5, paidBy: ownerId }],
    ['/events', { title: 'Party', startDate: '2030-01-01' }],
  ]) {
    const res = await post(path, body);
    assert.equal(res.status, 400, path);
    assert.equal((await res.json()).error.includes('householdId is required'), true, path);
  }
});

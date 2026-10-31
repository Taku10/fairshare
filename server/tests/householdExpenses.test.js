const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Household = require('../models/Household');
const HouseholdMembership = require('../models/HouseholdMembership');
const householdExpensesRouter = require('../routes/householdExpenses');

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
  const expenses = [];
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
  t.mock.method(Expense, 'find', (filter) =>
    query(() => expenses.filter((e) => matches(e, filter)))
  );
  t.mock.method(Expense, 'findOne', (filter) =>
    query(() => expenses.find((e) => matches(e, filter)) || null)
  );
  t.mock.method(Expense, 'create', async (doc) => {
    const expense = { _id: id(), ...doc };
    expenses.push(expense);
    return expense;
  });
  t.mock.method(Expense, 'findOneAndUpdate', (filter, update) =>
    query(() => {
      const expense = expenses.find((e) => matches(e, filter));
      if (expense) Object.assign(expense, update.$set);
      return expense || null;
    })
  );
  t.mock.method(Expense, 'findOneAndDelete', async (filter) => {
    const index = expenses.findIndex((e) => matches(e, filter));
    return index === -1 ? null : expenses.splice(index, 1)[0];
  });

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const user = req.headers['x-user'];
    if (user) req.user = { roommateId: user, displayName: 'Tester' };
    next();
  });
  app.use('/api/households/:householdId/expenses', householdExpensesRouter);

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
      resolve({ expenses, call });
    });
  });
}

const base = (hid) => `/api/households/${hid}/expenses`;
const lunch = (extra = {}) => ({
  description: 'Lunch',
  amount: 20,
  paidBy: String(userA),
  splitBetween: [String(userA), String(userA2)],
  ...extra,
});

test('requires authentication', async (t) => {
  const { call } = await setup(t);
  assert.equal((await call('GET', base(householdA), null)).status, 401);
});

test('members can create, list, read, update, and delete in their own household', async (t) => {
  const { call } = await setup(t);

  const created = await call('POST', base(householdA), userA, lunch());
  assert.equal(created.status, 201);
  assert.equal(String(created.body.householdId), String(householdA));

  const expenseId = created.body._id;
  assert.equal((await call('GET', base(householdA), userA2)).body.length, 1);
  assert.equal((await call('GET', `${base(householdA)}/${expenseId}`, userA)).status, 200);

  const updated = await call('PUT', `${base(householdA)}/${expenseId}`, userA, { amount: 30 });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.amount, 30);

  assert.equal((await call('DELETE', `${base(householdA)}/${expenseId}`, userA)).status, 200);
  assert.equal((await call('GET', base(householdA), userA)).body.length, 0);
});

test('adds the payer to the split once', async (t) => {
  const { call } = await setup(t);
  const created = await call('POST', base(householdA), userA, lunch({ splitBetween: [String(userA2)] }));
  assert.deepEqual(created.body.splitBetween.map(String).sort(), [String(userA), String(userA2)].sort());
});

test('a user cannot list, read, create, update, or delete in another household', async (t) => {
  const { call, expenses } = await setup(t);
  const own = await call('POST', base(householdB), userB, {
    description: 'Rent', amount: 100, paidBy: String(userB), splitBetween: [String(userB)],
  });
  const expenseId = own.body._id;

  assert.equal((await call('GET', base(householdB), userA)).status, 404);
  assert.equal((await call('GET', `${base(householdB)}/${expenseId}`, userA)).status, 404);
  assert.equal((await call('GET', `${base(householdB)}/balances/summary`, userA)).status, 404);
  assert.equal((await call('POST', base(householdB), userA, lunch())).status, 404);
  assert.equal((await call('PUT', `${base(householdB)}/${expenseId}`, userA, { amount: 1 })).status, 404);
  assert.equal((await call('DELETE', `${base(householdB)}/${expenseId}`, userA)).status, 404);

  assert.equal(expenses.length, 1);
  assert.equal(expenses[0].amount, 100);
});

test('an expense ID from another household is not reachable through your own household', async (t) => {
  const { call, expenses } = await setup(t);
  const foreign = await call('POST', base(householdB), userB, {
    description: 'Rent', amount: 100, paidBy: String(userB), splitBetween: [String(userB)],
  });
  const expenseId = foreign.body._id;

  assert.equal((await call('GET', `${base(householdA)}/${expenseId}`, userA)).status, 404);
  assert.equal((await call('PUT', `${base(householdA)}/${expenseId}`, userA, { amount: 1 })).status, 404);
  assert.equal((await call('DELETE', `${base(householdA)}/${expenseId}`, userA)).status, 404);
  assert.equal(expenses.length, 1);
  assert.equal(expenses[0].amount, 100);
});

test('list only returns the household expenses', async (t) => {
  const { call } = await setup(t);
  await call('POST', base(householdA), userA, lunch({ description: 'A expense' }));
  await call('POST', base(householdB), userB, {
    description: 'B expense', amount: 5, paidBy: String(userB), splitBetween: [String(userB)],
  });

  const res = await call('GET', base(householdA), userA);
  assert.deepEqual(res.body.map((e) => e.description), ['A expense']);
});

test('ignores a client-provided householdId on create and cannot move an expense on update', async (t) => {
  const { call, expenses } = await setup(t);
  const created = await call('POST', base(householdA), userA, lunch({ householdId: String(householdB) }));
  assert.equal(String(created.body.householdId), String(householdA));

  const updated = await call('PUT', `${base(householdA)}/${created.body._id}`, userA, {
    householdId: String(householdB),
    description: 'Renamed',
  });
  assert.equal(updated.status, 200);
  assert.equal(String(expenses[0].householdId), String(householdA));
  assert.equal(expenses[0].description, 'Renamed');
});

test('rejects a payer or split member who is not in the household', async (t) => {
  const { call, expenses } = await setup(t);

  assert.equal((await call('POST', base(householdA), userA, lunch({ paidBy: String(userB) }))).status, 400);
  assert.equal(
    (await call('POST', base(householdA), userA, lunch({ splitBetween: [String(userA), String(userB)] }))).status,
    400
  );
  assert.equal(expenses.length, 0);

  const ok = await call('POST', base(householdA), userA, lunch());
  const badPayer = await call('PUT', `${base(householdA)}/${ok.body._id}`, userA, { paidBy: String(userB) });
  const badSplit = await call('PUT', `${base(householdA)}/${ok.body._id}`, userA, { splitBetween: [String(userB)] });
  assert.equal(badPayer.status, 400);
  assert.equal(badSplit.status, 400);
  assert.equal(String(expenses[0].paidBy), String(userA));
});

test('balance summary only counts the household expenses', async (t) => {
  const { call, expenses } = await setup(t);
  await call('POST', base(householdA), userA, lunch());
  // Seeded directly: a stray record in another household that references user A.
  expenses.push({
    _id: id(),
    householdId: householdB,
    description: 'Huge',
    amount: 1000,
    paidBy: userA,
    splitBetween: [userA, userB],
  });

  const payer = await call('GET', `${base(householdA)}/balances/summary`, userA);
  assert.equal(payer.status, 200);
  assert.equal(payer.body[0].balance, 10);

  const debtor = await call('GET', `${base(householdA)}/balances/summary`, userA2);
  assert.equal(debtor.body[0].balance, -10);
});

test('validates IDs and required fields', async (t) => {
  const { call } = await setup(t);
  assert.equal((await call('GET', base('not-an-id'), userA)).status, 400);
  assert.equal((await call('GET', `${base(householdA)}/nope`, userA)).status, 400);
  assert.equal((await call('POST', base(householdA), userA, lunch({ description: ' ' }))).status, 400);
  assert.equal((await call('POST', base(householdA), userA, lunch({ amount: -5 }))).status, 400);
  assert.equal((await call('POST', base(householdA), userA, lunch({ paidBy: undefined }))).status, 400);
  assert.equal((await call('POST', base(householdA), userA, lunch({ paidBy: 'nope' }))).status, 400);
});

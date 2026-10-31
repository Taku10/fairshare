const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const ChatMessage = require('../models/ChatMessage');
const Chore = require('../models/Chore');
const Expense = require('../models/Expense');
const Household = require('../models/Household');
const HouseholdMembership = require('../models/HouseholdMembership');
const householdMessagesRouter = require('../routes/householdMessages');
const { registerChatHandlers } = require('../sockets/chat');

const id = () => new mongoose.Types.ObjectId();
const userA = id();
const userB = id();
const householdA = id();
const householdB = id();

function matches(doc, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some((branch) => matches(doc, branch));
    return String(doc[key]) === String(value);
  });
}

function query(resolve) {
  const q = {
    sort: () => q,
    populate: () => q,
    lean: () => q,
    then: (onFulfilled, onRejected) => Promise.resolve().then(resolve).then(onFulfilled, onRejected),
  };
  return q;
}

function mockData(t) {
  const messages = [];
  const chores = [];
  const memberships = [
    { householdId: householdA, userId: userA, role: 'owner', status: 'active' },
    { householdId: householdB, userId: userB, role: 'owner', status: 'active' },
  ];
  const households = [{ _id: householdA }, { _id: householdB }];

  t.mock.method(Household, 'findById', async (hid) =>
    households.find((h) => String(h._id) === String(hid)) || null
  );
  t.mock.method(HouseholdMembership, 'findOne', async (filter) =>
    memberships.find((m) => matches(m, filter)) || null
  );
  t.mock.method(Chore, 'findOne', async (filter) => chores.find((c) => matches(c, filter)) || null);
  t.mock.method(Expense, 'findOne', async () => null);
  t.mock.method(ChatMessage, 'find', (filter) => query(() => messages.filter((m) => matches(m, filter))));
  t.mock.method(ChatMessage, 'create', async (doc) => {
    const message = { _id: id(), ...doc, populate: async () => ({ _id: id(), ...doc }) };
    messages.push(message);
    return message;
  });
  return { messages, chores };
}

function setupHttp(t) {
  const data = mockData(t);
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const user = req.headers['x-user'];
    if (user) req.user = { roommateId: user };
    next();
  });
  app.use('/api/households/:householdId/messages', householdMessagesRouter);

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
      resolve({ ...data, call });
    });
  });
}

const base = (hid) => `/api/households/${hid}/messages`;

test('messages: requires authentication', async (t) => {
  const { call } = await setupHttp(t);
  assert.equal((await call('GET', base(householdA), null)).status, 401);
});

test('messages: members can post and read in their own household', async (t) => {
  const { call } = await setupHttp(t);
  const created = await call('POST', base(householdA), userA, { text: ' hello ' });
  assert.equal(created.status, 201);
  assert.equal(created.body.text, 'hello');
  assert.equal(String(created.body.householdId), String(householdA));

  const list = await call('GET', base(householdA), userA);
  assert.equal(list.body.length, 1);
});

test('messages: legacy roomId messages are still readable in their household', async (t) => {
  const { call, messages } = await setupHttp(t);
  messages.push({ _id: id(), roomId: householdA, text: 'old' });
  const list = await call('GET', base(householdA), userA);
  assert.deepEqual(list.body.map((m) => m.text), ['old']);
});

test('messages: a user cannot read or post in another household', async (t) => {
  const { call, messages } = await setupHttp(t);
  await call('POST', base(householdB), userB, { text: 'private' });

  assert.equal((await call('GET', base(householdB), userA)).status, 404);
  assert.equal((await call('POST', base(householdB), userA, { text: 'intruder' })).status, 404);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].text, 'private');
});

test('messages: list only returns the household messages', async (t) => {
  const { call } = await setupHttp(t);
  await call('POST', base(householdA), userA, { text: 'a' });
  await call('POST', base(householdB), userB, { text: 'b' });
  assert.deepEqual((await call('GET', base(householdA), userA)).body.map((m) => m.text), ['a']);
});

test('messages: ignores client householdId and sender', async (t) => {
  const { call, messages } = await setupHttp(t);
  await call('POST', base(householdA), userA, {
    text: 'hi',
    householdId: String(householdB),
    sender: String(userB),
  });
  assert.equal(String(messages[0].householdId), String(householdA));
  assert.equal(String(messages[0].sender), String(userA));
});

test('messages: related items must belong to the household', async (t) => {
  const { call, chores, messages } = await setupHttp(t);
  const foreignChore = id();
  chores.push({ _id: foreignChore, householdId: householdB });
  const ownChore = id();
  chores.push({ _id: ownChore, householdId: householdA });

  const foreign = await call('POST', base(householdA), userA, {
    text: 'x', relatedType: 'chore', relatedId: String(foreignChore),
  });
  assert.equal(foreign.status, 400);
  assert.equal(messages.length, 0);

  const own = await call('POST', base(householdA), userA, {
    text: 'x', relatedType: 'chore', relatedId: String(ownChore),
  });
  assert.equal(own.status, 201);
});

test('messages: validates IDs and text', async (t) => {
  const { call } = await setupHttp(t);
  assert.equal((await call('GET', base('not-an-id'), userA)).status, 400);
  assert.equal((await call('POST', base(householdA), userA, { text: '   ' })).status, 400);
  assert.equal((await call('POST', base(householdA), userA, { text: 5 })).status, 400);
  assert.equal((await call('POST', base(householdA), userA, { text: 'x', relatedType: 'nope', relatedId: String(id()) })).status, 400);
});

function fakeSocket(roommateId) {
  const handlers = {};
  return {
    user: { roommateId },
    rooms: new Set(),
    emitted: [],
    on(event, handler) { handlers[event] = handler; },
    join(room) { this.rooms.add(room); },
    emit(event, payload) { this.emitted.push([event, payload]); },
    trigger: (event, payload) => handlers[event](payload),
  };
}

function fakeIo() {
  const broadcasts = [];
  return { broadcasts, to: (room) => ({ emit: (event, payload) => broadcasts.push([room, event, payload]) }) };
}

test('socket: a member can join their own household channel', async (t) => {
  mockData(t);
  const socket = fakeSocket(userA);
  registerChatHandlers(fakeIo(), socket);
  await socket.trigger('joinHousehold', String(householdA));
  assert.ok(socket.rooms.has(String(householdA)));
  assert.deepEqual(socket.emitted, []);
});

test('socket: a user cannot join another household by guessing its ID', async (t) => {
  mockData(t);
  const socket = fakeSocket(userA);
  registerChatHandlers(fakeIo(), socket);
  await socket.trigger('joinHousehold', String(householdB));
  assert.equal(socket.rooms.size, 0);
  assert.deepEqual(socket.emitted, [['errorMessage', 'Household not found']]);
});

test('socket: malformed or missing household IDs are rejected without joining', async (t) => {
  mockData(t);
  const socket = fakeSocket(userA);
  registerChatHandlers(fakeIo(), socket);
  for (const bad of ['nope', undefined, null, 5, { $ne: null }, String(id()), '']) {
    await socket.trigger('joinHousehold', bad);
  }
  assert.equal(socket.rooms.size, 0);
  assert.ok(socket.emitted.every(([, message]) => message === 'Household not found'));
});

test('socket: denial message is identical for missing and unauthorized households', async (t) => {
  mockData(t);
  const socket = fakeSocket(userA);
  registerChatHandlers(fakeIo(), socket);
  await socket.trigger('joinHousehold', String(householdB));
  await socket.trigger('joinHousehold', String(id()));
  assert.equal(socket.emitted[0][1], socket.emitted[1][1]);
});

test('socket: a member can send a message that is broadcast to their household only', async (t) => {
  const { messages } = mockData(t);
  const io = fakeIo();
  const socket = fakeSocket(userA);
  registerChatHandlers(io, socket);
  await socket.trigger('sendMessage', { householdId: String(householdA), text: ' hi ' });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].text, 'hi');
  assert.equal(io.broadcasts.length, 1);
  assert.equal(io.broadcasts[0][0], String(householdA));
  assert.equal(io.broadcasts[0][1], 'chatMessage');
});

test('socket: a user cannot send a message into another household', async (t) => {
  const { messages } = mockData(t);
  const io = fakeIo();
  const socket = fakeSocket(userA);
  registerChatHandlers(io, socket);
  await socket.trigger('sendMessage', { householdId: String(householdB), text: 'intruder' });

  assert.equal(messages.length, 0);
  assert.equal(io.broadcasts.length, 0);
  assert.deepEqual(socket.emitted, [['errorMessage', 'Household not found']]);
});

test('socket: ignores empty, non-string, and malformed payloads', async (t) => {
  const { messages } = mockData(t);
  const socket = fakeSocket(userA);
  registerChatHandlers(fakeIo(), socket);
  for (const payload of [undefined, null, {}, { householdId: String(householdA) }, { householdId: String(householdA), text: '  ' }, { householdId: String(householdA), text: { $gt: '' } }]) {
    await socket.trigger('sendMessage', payload);
  }
  assert.equal(messages.length, 0);
});

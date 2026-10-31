const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const Household = require('../models/Household');
const HouseholdMembership = require('../models/HouseholdMembership');
const Roommate = require('../models/Roommate');
const householdsRouter = require('../routes/households');
const roommatesRouter = require('../routes/roommates');
const { generateInviteCode, CODE_PATTERN } = require('../utils/inviteCode');

const id = () => new mongoose.Types.ObjectId();
const owner = id();
const member = id();
const outsider = id();
const other = id();
const hhA = id();
const hhB = id();
const VALID = 'ABCDEFGHJK';

function has(doc, key, value) {
  if (value && typeof value === 'object' && '$gt' in value) return new Date(doc[key]) > value.$gt;
  if (value && typeof value === 'object' && '$in' in value) {
    return value.$in.some((v) => String(v) === String(doc[key]));
  }
  if (Array.isArray(doc[key])) return doc[key].some((v) => String(v) === String(value));
  return String(doc[key]) === String(value);
}
const matches = (doc, filter) => Object.entries(filter).every(([k, v]) => has(doc, k, v));

function query(resolve) {
  const q = {
    sort: () => q,
    populate: () => q,
    select: () => q,
    then: (a, b) => Promise.resolve().then(resolve).then(a, b),
  };
  return q;
}

function setup(t) {
  const future = new Date(Date.now() + 3600e3);
  const households = [
    { _id: hhA, name: 'A', code: VALID, codeExpiresAt: future, createdBy: owner, members: [owner, member] },
    { _id: hhB, name: 'B', code: 'MNPQRSTUVW', codeExpiresAt: future, createdBy: other, members: [other] },
  ].map((h) => ({ ...h, toObject() { const { toObject, ...rest } = this; return { ...rest }; } }));
  const memberships = [
    { householdId: hhA, userId: owner, role: 'owner', status: 'active' },
    { householdId: hhA, userId: member, role: 'member', status: 'active' },
    { householdId: hhB, userId: other, role: 'owner', status: 'active' },
  ];
  const roommates = [owner, member, outsider, other].map((_id) => ({ _id, displayName: String(_id) }));

  t.mock.method(Household, 'findById', (hid) =>
    query(() => households.find((h) => String(h._id) === String(hid)) || null)
  );
  t.mock.method(Household, 'findOne', (f) => query(() => households.find((h) => matches(h, f)) || null));
  t.mock.method(Household, 'find', (f) => query(() => households.filter((h) => matches(h, f))));
  t.mock.method(Household, 'create', async (doc) => {
    const h = { _id: id(), ...doc, toObject() { const { toObject, ...r } = this; return r; } };
    households.push(h);
    return h;
  });
  t.mock.method(Household, 'updateOne', async (f, u) => {
    const h = households.find((x) => matches(x, f));
    if (!h) return;
    if (u.$set) Object.assign(h, u.$set);
    if (u.$addToSet && !h.members.some((m) => String(m) === String(u.$addToSet.members))) h.members.push(u.$addToSet.members);
    if (u.$pull) h.members = h.members.filter((m) => String(m) !== String(u.$pull.members));
  });
  t.mock.method(Household, 'findOneAndUpdate', (f, u) =>
    query(() => {
      const h = households.find((x) => matches(x, f));
      if (h) Object.assign(h, u.$set);
      return h || null;
    })
  );
  t.mock.method(Household, 'findOneAndDelete', async (f) => {
    const i = households.findIndex((x) => matches(x, f));
    if (i !== -1) households.splice(i, 1);
  });
  t.mock.method(Household, 'deleteOne', async () => {});
  t.mock.method(HouseholdMembership, 'findOne', async (f) => memberships.find((m) => matches(m, f)) || null);
  t.mock.method(HouseholdMembership, 'find', (f) => query(() => memberships.filter((m) => matches(m, f))));
  t.mock.method(HouseholdMembership, 'create', async (doc) => memberships.push(doc));
  t.mock.method(HouseholdMembership, 'updateOne', async (f, u) => {
    if (!memberships.some((m) => matches(m, f))) {
      memberships.push({ ...f, ...u.$setOnInsert, status: 'active' });
    }
  });
  t.mock.method(HouseholdMembership, 'deleteOne', async (f) => {
    const i = memberships.findIndex((m) => matches(m, f));
    if (i !== -1) memberships.splice(i, 1);
  });
  t.mock.method(HouseholdMembership, 'deleteMany', async (f) => {
    for (let i = memberships.length - 1; i >= 0; i -= 1) if (matches(memberships[i], f)) memberships.splice(i, 1);
  });
  t.mock.method(Roommate, 'find', (f) => query(() => roommates.filter((r) => matches(r, f))));

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (req.headers['x-user']) req.user = { roommateId: req.headers['x-user'] };
    next();
  });
  app.use('/api/households', householdsRouter);
  app.use('/api/roommates', roommatesRouter);
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
        const text = await res.text();
        let parsed = null;
        try { parsed = JSON.parse(text); } catch { /* non-JSON default 404 page */ }
        return { status: res.status, body: parsed };
      };
      resolve({ households, memberships, call });
    });
  });
}

test('invite codes are random, unambiguous, and well-formed', () => {
  const codes = new Set(Array.from({ length: 200 }, generateInviteCode));
  assert.equal(codes.size, 200);
  for (const code of codes) assert.match(code, CODE_PATTERN);
});

test('creating a household issues an expiring invite code for the owner', async (t) => {
  const { call } = await setup(t);
  const res = await call('POST', '/api/households', outsider, { name: ' Flat ' });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, 'Flat');
  assert.match(res.body.code, CODE_PATTERN);
  assert.ok(new Date(res.body.codeExpiresAt) > new Date());
  assert.equal((await call('POST', '/api/households', outsider, { name: '  ' })).status, 400);
  assert.equal((await call('POST', '/api/households', outsider, { name: { $ne: 1 } })).status, 400);
});

test('only members can view a household; others get a generic 404', async (t) => {
  const { call } = await setup(t);
  assert.equal((await call('GET', `/api/households/${hhA}`, member)).status, 200);
  assert.equal((await call('GET', `/api/households/${hhA}`, outsider)).status, 404);
  assert.equal((await call('GET', `/api/households/${id()}`, outsider)).status, 404);
  assert.equal((await call('GET', `/api/households/${hhA}`, null)).status, 401);
});

test('the invite code is visible to owners only', async (t) => {
  const { call } = await setup(t);
  assert.equal((await call('GET', `/api/households/${hhA}`, owner)).body.code, VALID);
  const asMember = await call('GET', `/api/households/${hhA}`, member);
  assert.equal(asMember.body.code, undefined);
  assert.equal(asMember.body.codeExpiresAt, undefined);
  const list = await call('GET', '/api/households', member);
  assert.equal(list.body[0].code, undefined);
});

test('only the owner can update, delete, rotate, or revoke', async (t) => {
  const { call, households } = await setup(t);
  for (const [method, path, body] of [
    ['PUT', `/api/households/${hhA}`, { name: 'x' }],
    ['DELETE', `/api/households/${hhA}`],
    ['POST', `/api/households/${hhA}/invite`],
    ['DELETE', `/api/households/${hhA}/invite`],
  ]) {
    assert.equal((await call(method, path, member, body)).status, 403, `${method} ${path} as member`);
    assert.equal((await call(method, path, outsider, body)).status, 404, `${method} ${path} as outsider`);
  }
  assert.equal(households[0].name, 'A');
  assert.equal(households.length, 2);

  assert.equal((await call('PUT', `/api/households/${hhA}`, owner, { name: 'New', code: 'HACKED' })).body.name, 'New');
  assert.equal(households[0].code, VALID);
  assert.equal((await call('DELETE', `/api/households/${hhA}`, owner)).status, 200);
  assert.equal(households.length, 1);
});

test('joining requires a valid, unexpired, unrevoked code', async (t) => {
  const { call, memberships, households } = await setup(t);
  const join = (code, user = outsider) => call('POST', `/api/households/join/${code}`, user);

  assert.equal((await join('abc')).status, 404);
  assert.equal((await join('AAAAAAAAAA')).status, 404);
  assert.equal((await join('%24ne')).status, 404);

  households[0].codeExpiresAt = new Date(Date.now() - 1000);
  assert.equal((await join(VALID)).status, 404);
  households[0].codeExpiresAt = undefined;
  assert.equal((await join(VALID)).status, 404);
  assert.equal(memberships.filter((m) => String(m.userId) === String(outsider)).length, 0);

  households[0].codeExpiresAt = new Date(Date.now() + 3600e3);
  const ok = await join(VALID.toLowerCase());
  assert.equal(ok.status, 200);
  assert.equal(ok.body.code, undefined);
  assert.ok(memberships.some((m) => String(m.userId) === String(outsider) && m.role === 'member'));
});

test('rotating replaces the old code and revoking stops joins', async (t) => {
  const { call } = await setup(t);
  const fresh = await call('POST', `/api/households/${hhA}/invite`, owner);
  assert.notEqual(fresh.body.code, VALID);
  assert.equal((await call('POST', `/api/households/join/${VALID}`, outsider)).status, 404);

  assert.equal((await call('DELETE', `/api/households/${hhA}/invite`, owner)).status, 200);
  assert.equal((await call('POST', `/api/households/join/${fresh.body.code}`, outsider)).status, 404);
});

test('owners can remove members and members can leave, but not remove others', async (t) => {
  const { call, memberships, households } = await setup(t);
  const path = (u) => `/api/households/${hhA}/members/${u}`;

  assert.equal((await call('DELETE', path(owner), member)).status, 403);
  assert.equal((await call('DELETE', path(member), outsider)).status, 404);
  assert.equal((await call('DELETE', path(owner), owner)).status, 400);
  assert.equal((await call('DELETE', path('nope'), owner)).status, 400);
  assert.equal((await call('DELETE', path(outsider), owner)).status, 404);

  assert.equal((await call('DELETE', path(member), owner)).status, 200);
  assert.equal(memberships.some((m) => String(m.userId) === String(member)), false);
  assert.equal(households[0].members.some((m) => String(m) === String(member)), false);
  assert.equal((await call('GET', `/api/households/${hhA}`, member)).status, 404);
});

test('a member can leave a household', async (t) => {
  const { call, memberships } = await setup(t);
  assert.equal((await call('DELETE', `/api/households/${hhA}/members/${member}`, member)).status, 200);
  assert.equal(memberships.some((m) => String(m.userId) === String(member)), false);
});

test('removing a member never deletes the account', async (t) => {
  const { call } = await setup(t);
  const deleted = t.mock.method(Roommate, 'findByIdAndDelete', async () => {});
  await call('DELETE', `/api/households/${hhA}/members/${member}`, owner);
  assert.equal(deleted.mock.callCount(), 0);
});

test('roommates: account write routes are gone', async (t) => {
  const { call } = await setup(t);
  assert.equal((await call('POST', '/api/roommates', owner, { displayName: 'x' })).status, 404);
  assert.equal((await call('PUT', `/api/roommates/${member}`, owner, { displayName: 'x' })).status, 404);
  assert.equal((await call('DELETE', `/api/roommates/${member}`, owner)).status, 404);
});

test('roommates: list only includes people who share a household', async (t) => {
  const { call } = await setup(t);
  const asOwner = await call('GET', '/api/roommates', owner);
  assert.deepEqual(asOwner.body.map((r) => r._id), [String(member)]);
  assert.deepEqual((await call('GET', '/api/roommates', outsider)).body, []);
});

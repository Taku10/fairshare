const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const Household = require('../models/Household');
const HouseholdMembership = require('../models/HouseholdMembership');
const {
  requireHouseholdMembership,
  requireHouseholdRole,
} = require('../middleware/householdMembership');

const householdId = new mongoose.Types.ObjectId().toString();
const userId = new mongoose.Types.ObjectId();

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function createRequest(overrides = {}) {
  return {
    params: { householdId },
    user: { roommateId: userId },
    ...overrides,
  };
}

test('attaches the household and active membership for an authorized member', async (t) => {
  const household = { _id: householdId };
  const membership = { householdId, userId, role: 'member', status: 'active' };
  t.mock.method(Household, 'findById', async () => household);
  t.mock.method(HouseholdMembership, 'findOne', async () => membership);
  const req = createRequest();
  const res = createResponse();
  let nextCalled = false;

  await requireHouseholdMembership(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.household, household);
  assert.equal(req.householdMembership, membership);
  assert.equal(res.statusCode, null);
});

test('rejects requests without an authenticated user', async (t) => {
  const findHousehold = t.mock.method(Household, 'findById');
  const res = createResponse();

  await requireHouseholdMembership(createRequest({ user: undefined }), res, () => {});

  assert.equal(res.statusCode, 401);
  assert.equal(findHousehold.mock.callCount(), 0);
});

test('rejects malformed household IDs before querying', async (t) => {
  const findHousehold = t.mock.method(Household, 'findById');
  const res = createResponse();

  await requireHouseholdMembership(
    createRequest({ params: { householdId: 'not-an-id' } }),
    res,
    () => {}
  );

  assert.equal(res.statusCode, 400);
  assert.equal(findHousehold.mock.callCount(), 0);
});

test('returns not found when the household does not exist', async (t) => {
  t.mock.method(Household, 'findById', async () => null);
  const findMembership = t.mock.method(HouseholdMembership, 'findOne');
  const res = createResponse();

  await requireHouseholdMembership(createRequest(), res, () => {});

  assert.equal(res.statusCode, 404);
  assert.equal(findMembership.mock.callCount(), 0);
});

test('hides household existence from users without active membership', async (t) => {
  t.mock.method(Household, 'findById', async () => ({ _id: householdId }));
  t.mock.method(HouseholdMembership, 'findOne', async () => null);
  const res = createResponse();

  await requireHouseholdMembership(createRequest(), res, () => {});

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Household not found' });
});

test('returns a generic server error when a membership lookup fails', async (t) => {
  t.mock.method(Household, 'findById', async () => ({ _id: householdId }));
  t.mock.method(HouseholdMembership, 'findOne', async () => {
    throw new Error('database details');
  });
  const res = createResponse();

  await requireHouseholdMembership(createRequest(), res, () => {});

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'Failed to authorize household access');
  assert.equal(JSON.stringify(res.body).includes('database details'), false);
});

test('allows a request with one of the required household roles', () => {
  const req = { householdMembership: { role: 'owner' } };
  const res = createResponse();
  let nextCalled = false;

  requireHouseholdRole('owner', 'member')(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test('rejects requests without a required household role', () => {
  const req = { householdMembership: { role: 'member' } };
  const res = createResponse();
  let nextCalled = false;

  requireHouseholdRole('owner')(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});
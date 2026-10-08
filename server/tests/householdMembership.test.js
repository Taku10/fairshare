const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const HouseholdMembership = require('../models/HouseholdMembership');

test('requires household and user references', async () => {
  const membership = new HouseholdMembership({ role: 'owner' });

  await assert.rejects(membership.validate(), (error) => {
    assert.ok(error.errors.householdId);
    assert.ok(error.errors.userId);
    return true;
  });
});

test('defaults new memberships to active with a join date', async () => {
  const membership = new HouseholdMembership({
    householdId: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    role: 'member',
  });

  await membership.validate();

  assert.equal(membership.status, 'active');
  assert.ok(membership.joinedAt instanceof Date);
});

test('restricts roles to owner and member', async () => {
  const membership = new HouseholdMembership({
    householdId: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    role: 'admin',
  });

  await assert.rejects(membership.validate(), (error) => {
    assert.ok(error.errors.role);
    return true;
  });
});

test('declares a unique compound household and user index', () => {
  const membershipIndex = HouseholdMembership.schema.indexes().find(
    ([fields]) => fields.householdId === 1 && fields.userId === 1
  );

  assert.ok(membershipIndex);
  assert.equal(membershipIndex[1].unique, true);
});
const assert = require('node:assert/strict');
const test = require('node:test');
const Chore = require('../models/Chore');
const Expense = require('../models/Expense');
const Event = require('../models/Event');
const ChatMessage = require('../models/ChatMessage');

const householdOwnedModels = [
  ['Chore', Chore],
  ['Expense', Expense],
  ['Event', Event],
  ['ChatMessage', ChatMessage],
];

test('requires household ownership on all household-owned models', async (t) => {
  for (const [name, Model] of householdOwnedModels) {
    await t.test(name, async () => {
      const document = new Model({});

      await assert.rejects(document.validate(), (error) => {
        assert.ok(error.errors.householdId);
        return true;
      });
    });
  }
});

test('indexes household-owned records by their list sort order', () => {
  const expectedIndexes = new Map([
    [Chore, { householdId: 1, createdAt: -1 }],
    [Expense, { householdId: 1, date: -1 }],
    [Event, { householdId: 1, startDate: 1 }],
    [ChatMessage, { householdId: 1, createdAt: 1 }],
  ]);

  for (const [Model, expectedIndex] of expectedIndexes) {
    const index = Model.schema.indexes().find(
      ([fields]) => JSON.stringify(fields) === JSON.stringify(expectedIndex)
    );

    assert.ok(index, `${Model.modelName} is missing its household query index`);
  }
});

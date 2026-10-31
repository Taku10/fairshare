require('dotenv').config();
const mongoose = require('mongoose');
const Chore = require('../models/Chore');
const Expense = require('../models/Expense');
const Event = require('../models/Event');
const ChatMessage = require('../models/ChatMessage');
const Household = require('../models/Household');
const HouseholdMembership = require('../models/HouseholdMembership');
const { migrate, formatReport } = require('../utils/householdMigration');

const MODELS = { chores: Chore, expenses: Expense, events: Event, chatMessages: ChatMessage };
const UNOWNED = { $or: [{ householdId: { $exists: false } }, { householdId: null }] };

// Raw collection access bypasses the now-required householdId validation.
const store = {
  householdExists: async (id) => Boolean(await Household.exists({ _id: id })),
  listHouseholds: () => Household.find({}).select('createdBy members').lean(),
  hasMembership: async (householdId, userId) =>
    Boolean(await HouseholdMembership.exists({ householdId, userId })),
  addMembership: async (householdId, userId, role) => {
    try {
      await HouseholdMembership.updateOne(
        { householdId, userId },
        { $setOnInsert: { role } },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  },
  countOwned: (name) =>
    MODELS[name].collection.countDocuments({ householdId: { $exists: true, $ne: null } }),
  findUnowned: (name) =>
    MODELS[name].collection.find(UNOWNED, { projection: { roomId: 1 } }).toArray(),
  // Re-checking "unowned" in the filter keeps a re-run or concurrent run from overwriting.
  setHousehold: async (name, _id, householdId) => {
    const result = await MODELS[name].collection.updateOne(
      { _id, ...UNOWNED },
      { $set: { householdId: new mongoose.Types.ObjectId(householdId) } }
    );
    return result.modifiedCount === 1;
  },
};

function parseArgs(argv) {
  const args = { apply: false, household: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--apply') args.apply = true;
    else if (argv[i] === '--household') args.household = argv[(i += 1)];
    else if (argv[i].startsWith('--household=')) args.household = argv[i].split('=')[1];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

async function main() {
  const { apply, household } = parseArgs(process.argv.slice(2));
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');

  await mongoose.connect(process.env.MONGO_URI);
  try {
    const report = await migrate({ store, destinationHouseholdId: household, apply });
    console.log(formatReport(report));
    if (!apply) console.log('\nDry run only. Re-run with --apply after a verified backup.');
    process.exitCode = report.errors.length ? 1 : 0;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(`Migration failed: ${err.message}`);
  process.exit(1);
});

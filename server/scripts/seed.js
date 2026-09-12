require('dotenv').config();
const mongoose = require('mongoose');
const Roommate = require('../models/Roommate');
const Household = require('../models/Household');
const Expense = require('../models/Expense');
const Chore = require('../models/Chore');
const ChatMessage = require('../models/ChatMessage');

function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAmount(min, max, decimals = 2) {
  const val = Math.random() * (max - min) + min;
  return parseFloat(val.toFixed(decimals));
}

function randomCode(prefix = 'SEED') {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function randomDate(daysBack = 120) {
  const now = Date.now();
  const past = now - Math.floor(Math.random() * daysBack * 24 * 60 * 60 * 1000);
  return new Date(past);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to Mongo');

  // Optional: clear collections (set to true to wipe)
  const CLEAR = false;
  if (CLEAR) {
    await Promise.all([
      Roommate.deleteMany({}),
      Household.deleteMany({}),
      Expense.deleteMany({}),
      Chore.deleteMany({}),
      ChatMessage.deleteMany({}),
    ]);
    console.log('Cleared collections');
  }

  // Fix existing households with null codes to avoid unique index conflicts
  const householdsWithNullCode = await Household.find({ code: null });
  for (const household of householdsWithNullCode) {
    household.code = randomCode('HOUSEHOLD');
    await household.save();
  }
  if (householdsWithNullCode.length) {
    console.log(`Updated ${householdsWithNullCode.length} existing households with new codes to satisfy unique index`);
  }

  // Seed roommates
  const roommateSeeds = [
    'Alex Johnson','Maria Lopez','Sam Patel','Jamie Lee','Taylor Smith','Jordan Kim','Casey Brown','Riley Davis','Morgan Chen','Avery Clark','Drew Wilson','Parker Lewis'
  ];
  const roommates = [];
  for (const name of roommateSeeds) {
    const email = name.toLowerCase().replace(/[^a-z]/g,'') + '@example.com';
    const firebaseUid = `seed-${email}`;
    // Reuse existing seeded roommate if already present to avoid duplicate key errors
    let rm = await Roommate.findOne({ firebaseUid });
    if (!rm) {
      rm = await Roommate.create({ firebaseUid, email, displayName: name });
    }
    roommates.push(rm);
  }
  console.log(`Seeded roommates: ${roommates.length}`);

  // Create households
  const households = [];
  const householdNames = ['Default Household','Unit A','Unit B'];
  for (const householdName of householdNames) {
    const members = roommates
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.max(3, Math.floor(Math.random()* roommates.length)))
      .map(r => r._id);
    const household = await Household.create({ name: householdName, code: randomCode('HOUSEHOLD'), createdBy: members[0], members });
    households.push(household);
  }
  console.log(`Seeded households: ${households.length}`);

  // Seed expenses (~40)
  const expenseTitles = ['Rent','Internet','Groceries','Utilities','Water','Trash','Takeout','Ride-share','Streaming','Supplies','Snacks','Coffee'];
  const expenses = [];
  for (let i = 0; i < 42; i++) {
    const household = sample(households);
    const splitBetween = roommates
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.floor(Math.random()*4)+2) // 2-5 people
      .map(r => r._id);
    const paidBy = sample(splitBetween);
    const exp = await Expense.create({
      householdId: household._id,
      description: sample(expenseTitles),
      amount: randomAmount(8, 1200),
      paidBy,
      splitBetween,
      date: randomDate(),
    });
    expenses.push(exp);
  }
  console.log(`Seeded expenses: ${expenses.length}`);

  // Seed chores (~40)
  const choreTitles = ['Dishes','Vacuum','Mop kitchen','Clean bathroom','Take out trash','Wipe counters','Laundry','Restock supplies','Water plants','Organize fridge','Sweep porch','Dust living room'];
  const chores = [];
  for (let i = 0; i < 40; i++) {
    const household = sample(households);
    const assignedTo = Math.random() > 0.2 ? sample(roommates)._id : undefined;
    const chore = await Chore.create({
      householdId: household._id,
      title: sample(choreTitles),
      frequency: sample(['once','daily','weekly','monthly']),
      assignedTo,
      completed: Math.random() > 0.6,
      completedAt: Math.random() > 0.7 ? randomDate() : undefined,
      createdAt: randomDate(),
    });
    chores.push(chore);
  }
  console.log(`Seeded chores: ${chores.length}`);

  // Seed chat messages (~25)
  const messages = [];
  const chatTexts = [
    'I paid internet, please settle balances.',
    'Trash day is tomorrow.',
    'Anyone need groceries?',
    'Can someone vacuum before guests?',
    'Utilities bill posted.',
    'Let’s split the takeout.',
    'I cleaned the bathroom.',
    'Rent reminder.',
  ];
  for (let i = 0; i < 25; i++) {
    const household = sample(households);
    const sender = sample(roommates)._id;
    const msg = await ChatMessage.create({
      householdId: household._id,
      sender,
      text: sample(chatTexts),
      createdAt: randomDate(),
    });
    messages.push(msg);
  }
  console.log(`Seeded chat messages: ${messages.length}`);

  // Summary counts
  const counts = {
    roommates: await Roommate.countDocuments(),
    households: await Household.countDocuments(),
    expenses: await Expense.countDocuments(),
    chores: await Chore.countDocuments(),
    messages: await ChatMessage.countDocuments(),
  };
  console.log('Counts:', counts);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

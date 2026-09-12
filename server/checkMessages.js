const mongoose = require('mongoose');
require('dotenv').config();
const ChatMessage = require('./models/ChatMessage');
const Household = require('./models/Household');
const Roommate = require('./models/Roommate');

async function checkMessages() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const messages = await ChatMessage.find()
      .populate('sender')
      .populate('householdId')
      .populate('roomId')
      .lean();

    console.log(`📊 Total messages in database: ${messages.length}\n`);

    if (messages.length === 0) {
      console.log('No messages found in database.\n');
    } else {
      messages.forEach((msg, index) => {
        console.log(`--- Message ${index + 1} ---`);
        console.log(`ID: ${msg._id}`);
        const household = msg.householdId || msg.roomId;
        console.log(`Household: ${household?.name || household || 'N/A'} (${household?._id || 'N/A'})`);
        console.log(`Sender: ${msg.sender?.displayName || msg.sender?.email || 'Unknown'} (${msg.sender?._id || 'N/A'})`);
        console.log(`Text: "${msg.text}"`);
        console.log(`Created: ${msg.createdAt}`);
        if (msg.relatedType) {
          console.log(`Related: ${msg.relatedType} - ${msg.relatedId}`);
        }
        console.log('');
      });
    }

    const households = await Household.find().populate('members').lean();
    console.log(`📦 Total households: ${households.length}`);
    households.forEach(household => {
      console.log(`  - ${household.name} (${household._id}): ${household.members?.length || 0} members`);
    });

    const roommates = await Roommate.find().lean();
    console.log(`\n👥 Total roommates: ${roommates.length}`);
    roommates.forEach(rm => {
      console.log(`  - ${rm.displayName || rm.email} (${rm._id})`);
    });

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkMessages();

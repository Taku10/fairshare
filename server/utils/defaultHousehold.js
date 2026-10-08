const Household = require('../models/Household');

async function getOrCreateDefaultHouseholdFor(roommateId) {
  let household = await Household.findOne({ name: { $in: ['Default Household', 'Default Room'] } });
  if (!household) {
    household = await Household.create({ name: 'Default Household', createdBy: roommateId, members: [roommateId] });
  } else {
    const isMember = household.members.some((member) => String(member) === String(roommateId));
    if (!isMember) {
      household.members.push(roommateId);
      await household.save();
    }
  }
  return household;
}

module.exports = getOrCreateDefaultHouseholdFor;
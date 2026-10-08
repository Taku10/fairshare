const mongoose = require('mongoose');
const Household = require('../models/Household');
const HouseholdMembership = require('../models/HouseholdMembership');

async function requireHouseholdMembership(req, res, next) {
  if (!req.user?.roommateId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { householdId } = req.params;
  if (!/^[a-f\d]{24}$/i.test(householdId || '') || !mongoose.isValidObjectId(householdId)) {
    return res.status(400).json({ error: 'Invalid household ID' });
  }

  try {
    const household = await Household.findById(householdId);
    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }

    const membership = await HouseholdMembership.findOne({
      householdId,
      userId: req.user.roommateId,
      status: 'active',
    });
    if (!membership) {
      return res.status(404).json({ error: 'Household not found' });
    }

    req.household = household;
    req.householdMembership = membership;
    return next();
  } catch {
    return res.status(500).json({ error: 'Failed to authorize household access' });
  }
}

function requireHouseholdRole(...roles) {
  return (req, res, next) => {
    if (!req.householdMembership) {
      return res.status(403).json({ error: 'Household membership required' });
    }

    if (!roles.includes(req.householdMembership.role)) {
      return res.status(403).json({ error: 'Insufficient household role' });
    }

    return next();
  };
}

module.exports = { requireHouseholdMembership, requireHouseholdRole };
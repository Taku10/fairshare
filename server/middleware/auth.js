
const admin = require('../firebaseAdmin');
const Roommate = require('../models/Roommate');
const { isDevAuthBypassEnabled } = require('../utils/devAuth');

// Development bypass: set ALLOW_DEV_AUTH=true in server/.env to skip Firebase verification
// and use a local/dev roommate (useful when firebase-admin isn't configured locally).
async function devBypass(req, res, next) {
  const devUid = process.env.DEV_FIREBASE_UID || 'dev-uid-1';
  const devEmail = process.env.DEV_EMAIL || 'dev@local';
  const devName = process.env.DEV_NAME || 'Dev User';

  try {
    const roommate = await Roommate.findOneAndUpdate(
      { firebaseUid: devUid },
      {
        $setOnInsert: {
          firebaseUid: devUid,
          email: devEmail,
          displayName: devName,
        },
      },
      {
        new: true,
        upsert: true,
      }
    );

    req.user = {
      firebaseUid: devUid,
      roommateId: roommate._id,
      email: roommate.email,
      displayName: roommate.displayName,
    };

    return next();
  } catch (err) {
    console.error('Dev bypass error:', err);
    return res.status(500).json({ error: 'Dev auth error' });
  }
}

async function authMiddleware(req, res, next) {
  // If allowed, enable developer bypass to proceed without Firebase Admin setup
  if (isDevAuthBypassEnabled()) {
    return devBypass(req, res, next);
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    // decoded: { uid, email, name, ... }

    // Find or create Roommate
    const roommate = await Roommate.findOneAndUpdate(
      { firebaseUid: decoded.uid },
      {
        $setOnInsert: {
          firebaseUid: decoded.uid,
          email: decoded.email,
          displayName: decoded.name || decoded.email.split('@')[0],
        },
      },
      {
        new: true,
        upsert: true,
      }
    );

    req.user = {
      firebaseUid: decoded.uid,
      roommateId: roommate._id,
      email: roommate.email,
      displayName: roommate.displayName,
    };

    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = authMiddleware;

// server/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

const admin = require('./firebaseAdmin');
const Roommate = require('./models/Roommate');
const Household = require('./models/Household');
const ChatMessage = require('./models/ChatMessage');
const { isDevAuthBypassEnabled } = require('./utils/devAuth');

const app = express();

app.set("trust proxy", 2); // Trust first two proxies (useful if behind a reverse proxy)

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://fairshare.takunda.cloud',
    'https://fareshare-20b22.firebaseapp.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());


// Rate limiting middleware
// General API rate limit - 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Stricter rate limit for write operations - 30 requests per 15 minutes
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 write requests per windowMs
  message: 'Too many requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
const householdsRouter = require('./routes/households');
const choresRouter = require('./routes/chores');
const expensesRouter = require('./routes/expenses');
const roomatesRouter = require('./routes/roommates');
const chatRouter = require('./routes/chat'); // for history REST
const eventsRouter = require('./routes/events');

const authMiddleware = require('./middleware/auth');

// Apply general rate limiting to all API routes
app.use('/api', apiLimiter);

// Protect API routes with Firebase Auth
app.use('/api', authMiddleware);

// Apply stricter rate limiting to write operations
app.use('/api/households', writeLimiter, householdsRouter);
app.use('/api/chores', writeLimiter, choresRouter);
app.use('/api/expenses', writeLimiter, expensesRouter);
app.use('/api/roommates', writeLimiter, roomatesRouter);
app.use('/api/chat', writeLimiter, chatRouter);
app.use('/api/events', writeLimiter, eventsRouter);

// --- HTTP server + socket.io ---
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    // Allow both common Vite ports
    origin: ['http://localhost:5173',
    'http://localhost:5174',
    'https://fairshare.takunda.cloud',
    'https://fareshare-20b22.firebaseapp.com'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// socket.io auth using Firebase token
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    let decoded;

    // If dev bypass is enabled, synthesize a decoded token from DEV_* env vars
    if (isDevAuthBypassEnabled()) {
      decoded = {
        uid: process.env.DEV_FIREBASE_UID || 'dev-uid-1',
        email: process.env.DEV_EMAIL || 'dev@local',
        name: process.env.DEV_NAME || 'Dev User',
      };
    } else {
      if (!token) return next(new Error('No token'));
      decoded = await admin.auth().verifyIdToken(token);
    }

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

    socket.user = {
      roommateId: roommate._id,
      email: roommate.email,
      displayName: roommate.displayName,
    };

    next();
  } catch (err) {
    console.error('Socket auth error:', err);
    next(new Error('Unauthorized'));
  }
});

// Check membership before allowing a socket to use a household channel.
async function ensureSocketHouseholdMember(socket, householdId) {
  const household = await Household.findById(householdId);
  if (!household) throw new Error('Household not found');
  const isMember = household.members.some(
    (m) => String(m) === String(socket.user.roommateId)
  );
  if (!isMember) throw new Error('Not a member of this household');
}

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.user.displayName);

  // Join the Socket.IO room used internally for a household.
  socket.on('joinHousehold', async (householdId) => {
    try {
      await ensureSocketHouseholdMember(socket, householdId);
      socket.join(householdId);
      console.log(`${socket.user.displayName} joined household ${householdId}`);
    } catch (err) {
      console.error('joinHousehold error:', err.message);
      socket.emit('errorMessage', err.message);
    }
  });

  // send a message
  socket.on('sendMessage', async (payload) => {
    try {
      const { householdId, text, relatedType, relatedId } = payload;
      if (!text || !householdId) return;

      await ensureSocketHouseholdMember(socket, householdId);

      const msg = await ChatMessage.create({
        householdId,
        sender: socket.user.roommateId,
        text,
        relatedType: relatedType || null,
        relatedId: relatedId || null,
      });

      const populated = await msg.populate('sender');

      // Broadcast to the Socket.IO room for this household.
      io.to(householdId).emit('chatMessage', populated);
    } catch (err) {
      console.error('sendMessage error:', err.message);
      socket.emit('errorMessage', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected:', socket.user?.displayName);
  });
});

// --- Mongo + server start 
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI environment variable is not set. Please create a server/.env file with MONGO_URI defined.');
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Server + Socket listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

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
const { registerChatHandlers } = require('./sockets/chat');
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

// Invite-code guessing protection - 10 join attempts per 15 minutes per IP
const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many join attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
const householdsRouter = require('./routes/households');
const choresRouter = require('./routes/chores');
const householdChoresRouter = require('./routes/householdChores');
const expensesRouter = require('./routes/expenses');
const householdExpensesRouter = require('./routes/householdExpenses');
const roomatesRouter = require('./routes/roommates');
const chatRouter = require('./routes/chat'); // for history REST
const eventsRouter = require('./routes/events');
const householdEventsRouter = require('./routes/householdEvents');
const householdMessagesRouter = require('./routes/householdMessages');

const authMiddleware = require('./middleware/auth');

// Apply general rate limiting to all API routes
app.use('/api', apiLimiter);

// Protect API routes with Firebase Auth
app.use('/api', authMiddleware);

// Apply stricter rate limiting to write operations
app.use('/api/households/:householdId/chores', writeLimiter, householdChoresRouter);
app.use('/api/households/:householdId/expenses', writeLimiter, householdExpensesRouter);
app.use('/api/households/:householdId/events', writeLimiter, householdEventsRouter);
app.use('/api/households/:householdId/messages', writeLimiter, householdMessagesRouter);
app.use('/api/households/join', joinLimiter);
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

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.user.displayName);

  registerChatHandlers(io, socket);

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

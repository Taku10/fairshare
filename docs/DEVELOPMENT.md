# Development Guide

This guide covers local setup and development workflow for FairShare.

## Architecture overview

FairShare is split into two Node-based applications:

- `client` (React + Vite): UI, Firebase Web Auth, REST API calls, Socket.IO client
- `server` (Express + Mongoose): authenticated REST API, Socket.IO server, MongoDB persistence

All REST routes are served under `/api/*` and protected by auth middleware.

## Local environment setup

## 1) Backend (`server/.env`)

Required:

```env
MONGO_URI=mongodb://localhost:27017/fairshare
PORT=5000
```

Auth options (choose one):

### Option A: Firebase Admin service account file

```env
SERVICE_ACCOUNT_PATH=/absolute/path/to/serviceAccountKey.json
```

### Option B: Firebase Admin credentials from env

```env
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Option C: Local development auth bypass

Use only for local development:

```env
NODE_ENV=development
ALLOW_DEV_AUTH=true
DEV_FIREBASE_UID=dev-uid-1
DEV_EMAIL=dev@local
DEV_NAME=Dev User
```

`ALLOW_DEV_AUTH=true` is ignored unless `NODE_ENV` is `development` or `test`.

## 2) Frontend (`client/.env`)

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_API_BASE=http://localhost:5000/api
VITE_AUTH_IN_MEMORY=false
```

## Installation

```bash
cd client && npm ci
cd ../server && npm ci
```

## Run the app

```bash
# terminal 1
cd server
npm run dev

# terminal 2
cd client
npm run dev
```

## CORS and local ports

Server CORS currently allows localhost origins for browser API calls and explicitly allows Socket.IO origins:

- `http://localhost:5173`
- `http://localhost:5174`

If you use a different frontend origin, update server CORS configuration.

## Validation workflow

From `client/`:

```bash
npm run lint
npm run build
```

From `server/`:

```bash
npm ci
```

This mirrors current CI jobs.

## Data model (high-level)

- `Roommate` — user profile mapped to Firebase UID
- `Household` — group with members and a creator
- `Chore` — task with assignment/completion state
- `Expense` — shared cost with payer + split participants
- `Event` — calendar entries and bill metadata
- `ChatMessage` — household-scoped message feed

## Realtime chat notes

- Socket auth expects Firebase ID token via `socket.handshake.auth.token` unless dev auth bypass is enabled
- Clients join a household channel using `joinHousehold(householdId)`
- Messages are sent with `sendMessage({ householdId, text, relatedType, relatedId })`
- Server broadcasts `chatMessage`

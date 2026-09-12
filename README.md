# FairShare

FairShare is a full-stack roommate coordination app for managing chores, shared expenses, events, rooms, and chat in one place.

> **Release status:** `v0.1.0` is an initial preview for one trusted household. Household isolation is not yet complete for chores, expenses, events, and roommate data. See the [v0.1.0 release notes](docs/releases/v0.1.0.md).

## Repository layout

- `client/` — React + Vite frontend with Firebase Authentication
- `server/` — Express + MongoDB API with Firebase Admin auth verification and Socket.IO chat
- `docs/` — Additional project documentation

## Core features

- Email/password auth with Firebase
- Room creation and joining via room code
- Chore tracking and assignment
- Expense tracking with balance summary
- Roommate profiles
- Event/calendar support (including unpaid bill events)
- Real-time room chat via Socket.IO

## Tech stack

- Frontend: React 19, Vite, Axios, Firebase Web SDK
- Backend: Node.js, Express 5, Mongoose, Firebase Admin SDK, Socket.IO
- CI/CD: GitHub Actions for validation, Firebase Hosting, and multi-architecture GHCR image builds

## Prerequisites

- Node.js 20+
- npm 10+
- MongoDB instance
- Firebase project:
  - Web app config for frontend auth
  - Service account/admin credentials for backend token verification

## Quick start

### 1) Clone and install

```bash
# from repository root
cd client && npm ci
cd ../server && npm ci
```

### 2) Configure environment

Create:

- `client/.env`
- `server/.env`

See:

- [Development guide](docs/DEVELOPMENT.md) for full setup details
- [API reference](docs/API.md) for endpoint details
- [Architecture](docs/ARCHITECTURE.md) for application and deployment boundaries
- [v0.1.0 release notes](docs/releases/v0.1.0.md) for included features and known limitations

Note: local auth bypass (`ALLOW_DEV_AUTH=true`) is only honored when `NODE_ENV` is `development` or `test`.

### 3) Run locally

```bash
# terminal 1
cd server
npm run dev

# terminal 2
cd client
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- API: `http://localhost:5000/api`

## Scripts

### Client (`client/package.json`)

- `npm run dev` — start Vite dev server
- `npm run lint` — run ESLint
- `npm run build` — production build
- `npm run preview` — preview production build locally

### Server (`server/package.json`)

- `npm run start` — start Express server
- `npm run dev` — start server with nodemon
- `npm run seed` — run seed script

## Validation

Current CI validates:

- Client lint (`npm run lint`)
- Client build (`npm run build`)
- Server dependency installation (`npm ci`) and entrypoint presence

For local parity, run the same commands in each package directory.

## Deployment

GitHub Actions provides two delivery paths:

- `.github/workflows/ci.yml` validates every push and pull request, and deploys the client to Firebase Hosting from `main` or `develop`.
- `.github/workflows/build-images.yaml` builds AMD64 and ARM64 client/server images on pushes to `main`, then publishes commit-SHA tags to GHCR.

K3s manifests and environment promotion are maintained in the separate [k3s-platform repository](https://github.com/Taku10/k3s-platform).

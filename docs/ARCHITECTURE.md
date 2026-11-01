# FairShare architecture

This document describes the household-isolation architecture introduced during `v0.3.0`. Existing production data still requires the documented migration.

## System overview

FairShare is a two-service web application:

- **Client:** React 19 and Vite, served as static files by Nginx in the container image.
- **API:** Node.js, Express 5, Mongoose, and Socket.IO.
- **Authentication:** Firebase Authentication in the browser; Firebase Admin verifies ID tokens in the API and Socket.IO handshake.
- **Data:** MongoDB stores users, households, chores, expenses, events, and chat messages.
- **Images:** GitHub Actions builds multi-architecture client and server images and publishes commit-SHA tags to GHCR.

The Kubernetes deployment configuration is maintained separately in the [k3s-platform repository](https://github.com/Taku10/k3s-platform).

## Request flow

1. A user signs in through Firebase Authentication.
2. The client obtains a Firebase ID token.
3. REST requests send the token in the `Authorization: Bearer <token>` header.
4. The API verifies the token and resolves or creates the matching roommate record.
5. Route handlers read or write MongoDB data.
6. Household resource routes and Socket.IO verify active membership before reading or writing household data.
7. The client stores an active household selection and uses household-scoped APIs for chores, expenses, events, members, and messages.

## Main data entities

| Entity | Purpose |
| --- | --- |
| `Roommate` | Global user profile linked to a Firebase UID |
| `Household` | Group with a creator, embedded members, and invite code; documents temporarily remain in MongoDB's `rooms` collection |
| `Chore` | Assigned household task |
| `Expense` | Shared cost and payment state |
| `Event` | Calendar item or bill reminder |
| `ChatMessage` | Message scoped to a household |

## Delivery flow

- Pull requests and branch pushes run the client lint/build and server installation checks.
- Pushes to `main` build multi-architecture client and server images in GHCR.
- The application repository also contains a Firebase Hosting deployment workflow.
- K3s manifests and environment promotion are managed from `k3s-platform`.

Container images are currently tagged with the first seven characters of the source commit SHA. A Git release tag identifies the source snapshot; it does not automatically retag the images.

## Security and tenancy status

Firebase authentication is enabled. Chores, expenses, events, messages, and household reads use membership-checked, household-scoped routes. Socket.IO verifies active membership before joining or sending. The unscoped chore, expense, event, and chat route mounts have been removed. Household creation, invitations, and member removal use owner/member rules.

- New records require `householdId`; the default-household fallback is removed.
- The migration script is available at [MIGRATION.md](./MIGRATION.md), but it must be run against existing data before that data is available through scoped routes.
- Legacy `roomId` chat records remain readable and are handled by the migration.
- The client selector is a UI convenience only; the server authorizes every scoped request independently.
- Cross-household end-to-end testing and final release documentation remain before `v0.3.0` is complete.

## Next architecture milestone

The remaining `v0.3.0` work is cross-household end-to-end testing, CI coverage, and release documentation. Operational rollout also requires a backup, migration dry run, and migration verification.

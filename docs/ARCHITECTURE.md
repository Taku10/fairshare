# FairShare architecture

This document describes the application as it exists in the `v0.2.0` Household Foundation prerelease. Household terminology is in place, but complete multi-household isolation is not.

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
6. Chat uses an authenticated Socket.IO connection and checks the household's embedded member list before joining its channel. This check does not protect the other resource APIs.

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

Firebase authentication is enabled. Chat verifies membership for its REST and Socket.IO operations, but `v0.2.0` does **not** provide complete household isolation:

- Chore, expense, event, and roommate endpoints are not consistently scoped by household membership.
- Some resource lookups, updates, and deletes use only a resource ID.
- New household-owned records require `householdId`, but existing records have not been migrated and may still lack it.
- The shared default-household fallback has been removed; legacy create routes now require `householdId`.
- A separate membership model and reusable authorization middleware exist, but the middleware is not yet wired into the household resource routes; embedded `Household.members` is still used by existing flows.
- Roles and invitation lifecycle management are incomplete.
- Legacy `roomId` records have not been migrated.

For that reason, this version is suitable only for one trusted household. It should not be offered to unrelated households until every household-owned record has a household identifier and every API operation verifies membership and scopes its database operations.

## Next architecture milestone

The `v0.3.0` architecture milestone should introduce:

1. A documented migration for existing records with missing `householdId` or legacy `roomId`.
2. Household-scoped creation routes that set `householdId` from authorized request context.
3. Wire the existing household-membership middleware and membership records into protected routes.
4. Household-scoped database operations and query indexes based on actual access patterns.
5. Explicit update allowlists for all protected resources.
6. Tests proving that a member of household A cannot read or change household B data.
7. Secure invitations and household member lifecycle behavior.

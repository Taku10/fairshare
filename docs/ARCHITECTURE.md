# FairShare architecture

This document describes the application as it exists in the `v0.1.0` preview.

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
6. Chat uses an authenticated Socket.IO connection and joins a household channel only after membership is checked.

## Main data entities

| Entity | Purpose |
| --- | --- |
| `Roommate` | Application profile linked to a Firebase UID |
| `Household` | Group with a creator, members, and invite code |
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

Firebase authentication is enabled, and real-time chat verifies household membership. However, `v0.1.0` does **not** yet provide complete household isolation:

- Chores, expenses, events, and member queries are not consistently scoped by household.
- Some resource lookups do not consistently verify membership.
- Some update paths accept broader input than a production multi-tenant API should.

For that reason, this version is suitable as an initial preview or a single trusted household deployment. It should not be offered to unrelated households until every household-owned record includes a household identifier and every API operation verifies membership and role permissions.

## Next architecture milestone

The next milestone should introduce:

1. A required `householdId` on all household-owned records.
2. A reusable membership/role authorization middleware.
3. Household-scoped query indexes such as `{ householdId: 1, createdAt: -1 }`.
4. Explicit update allowlists instead of passing request bodies directly to database updates.
5. Tests proving that a member of household A cannot read or change household B data.
6. Invitation lifecycle, member removal, and owner/admin roles.

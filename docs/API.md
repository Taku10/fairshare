# API Reference

Base URL (local default): `http://localhost:5000/api`

All API endpoints require `Authorization: Bearer <firebase-id-token>` unless server dev auth bypass is enabled.

This reference describes the `v0.2.0` Household Foundation prerelease. Authentication alone does not provide household authorization: most chore, expense, event, and roommate endpoints below are not consistently scoped to a household. Use this version only for one trusted household. Household-scoped resource routes and complete membership checks are planned for `v0.3.0`.

## Households

### `POST /households`
Create a household.

### `GET /households`
List households where the current user is a member.

### `GET /households/:householdId`
Get household details. This endpoint currently does not verify that the authenticated user is a member.

### `POST /households/join/:code`
Join a household by invite code.

Invite codes currently have no expiration or revocation lifecycle. Join attempts do not have a dedicated rate limit.

### `PUT /households/:householdId`
Update a household (creator only). Only the `name` field is currently accepted.

### `DELETE /households/:householdId`
Delete a household (creator only).

Household documents continue to use MongoDB's `rooms` collection.

## Roommates

### `POST /roommates`
Create roommate record.

### `GET /roommates`
List all roommates excluding current user. This endpoint is not scoped to a household.

### `GET /roommates/me`
Get current user profile.

### `PUT /roommates/me`
Update current user profile fields (`displayName`, `bio`, `profilePicture`).

### `PUT /roommates/:id`
Update roommate by ID. This endpoint currently accepts unrestricted fields and is not limited to the current user's profile.

### `DELETE /roommates/:id`
Delete roommate by ID. This endpoint deletes the global roommate record and is not a household-membership removal operation.

## Chores

### `POST /chores`
Create a chore. The current route accepts request fields directly and may assign a shared default household when `householdId` is absent.

### `GET /chores`
List all chores; results are not filtered by household membership.

### `PUT /chores/:id`
Update chore fields (`title`, `assignedTo`, `completed`, and `householdId`) by chore ID. The lookup does not enforce household membership.

### `DELETE /chores/:id`
Delete chore by ID without checking household membership.

## Expenses

### `POST /expenses`
Create expense. Requires valid `description`, positive `amount`, and `paidBy`. If `householdId` is omitted, the current route may assign the shared default household. Referenced users are not validated against household membership.

### `GET /expenses`
List all expenses; results are not filtered by household membership.

### `PUT /expenses/:id`
Update expense fields (`description`, `amount`, `paidBy`, `splitBetween`) by expense ID. The lookup does not enforce household membership or validate referenced users against the same household.

### `DELETE /expenses/:id`
Delete expense by ID without checking household membership.

### `GET /expenses/balances/summary`
Get the current user's net balance calculated from all expenses, not a household-specific summary.

## Events

### `GET /events`
List all events; results are not filtered by household membership.

### `GET /events/range?start=<iso>&end=<iso>`
List events in date range.

### `GET /events/upcoming`
List upcoming events (limited).

### `GET /events/bills/unpaid`
List unpaid bill events.

### `POST /events`
Create event (creator is current user). The route does not require or derive a `householdId`.

### `PUT /events/:id`
Update event by ID. The current route accepts unrestricted request fields and does not enforce household membership.

### `PATCH /events/:id/pay`
Mark bill event as paid by ID without checking household membership.

### `DELETE /events/:id`
Delete event by ID without checking household membership.

## Chat (REST history endpoints)

### `GET /chat/:householdId/chat`
Get household message history (membership required).

### `POST /chat/:householdId/chat`
Create household message (membership required).

## Socket.IO events

After connecting with auth token:

- Client emits `joinHousehold(householdId)`
- Client emits `sendMessage({ householdId, text, relatedType?, relatedId? })`
- Server emits `chatMessage` with populated sender
- Server may emit `errorMessage`

## Rate limits

Configured in server:

- General API: 100 requests / 15 minutes / IP
- Write-heavy routes: 1000 requests / 15 minutes / IP (the server configuration differs from its comment, which says 30)

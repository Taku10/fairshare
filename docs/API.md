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

### Household-scoped routes (preferred)

All require an active household membership. Non-members, and nonexistent households, receive `404`; malformed IDs receive `400`.

- `GET /households/:householdId/chores` — list the household's chores.
- `GET /households/:householdId/chores/:choreId` — get one chore.
- `POST /households/:householdId/chores` — create a chore. Accepts `title`, `description`, `dueDate`, `assignedTo`. `householdId` is always set from the route; a body value is ignored.
- `PUT /households/:householdId/chores/:choreId` — update `title`, `description`, `dueDate`, `assignedTo`, `completed`. `householdId` cannot be changed.
- `DELETE /households/:householdId/chores/:choreId` — delete a chore.

`assignedTo` must be an active member of the household (or `null` to unassign). Lookups, updates, and deletes always include the household filter.

### Legacy routes (deprecated, insecure)

These remain only until the frontend moves to the scoped routes and are removed after that. They are not household-scoped.

### `POST /chores`
Create a chore. The current route accepts request fields directly and may assign a shared default household when `householdId` is absent.

### `GET /chores`
List all chores; results are not filtered by household membership.

### `PUT /chores/:id`
Update chore fields (`title`, `assignedTo`, `completed`, and `householdId`) by chore ID. The lookup does not enforce household membership.

### `DELETE /chores/:id`
Delete chore by ID without checking household membership.

## Expenses

### Household-scoped routes (preferred)

All require an active household membership. Non-members, and nonexistent households, receive `404`; malformed IDs receive `400`.

- `GET /households/:householdId/expenses` — list the household's expenses.
- `GET /households/:householdId/expenses/:expenseId` — get one expense.
- `POST /households/:householdId/expenses` — create an expense. Requires `description`, positive `amount`, and `paidBy`; accepts `splitBetween` and `date`. The payer is always included in the split. `householdId` is always set from the route; a body value is ignored.
- `PUT /households/:householdId/expenses/:expenseId` — update `description`, `amount`, `date`, `paidBy`, `splitBetween`. `householdId` cannot be changed.
- `DELETE /households/:householdId/expenses/:expenseId` — delete an expense.
- `GET /households/:householdId/expenses/balances/summary` — the current user's net balance, calculated only from this household's expenses.

The payer and everyone in `splitBetween` must be active members of the household. Lookups, updates, and deletes always include the household filter.

### Legacy routes (deprecated, insecure)

These remain only until the frontend moves to the scoped routes and are removed after that. They are not household-scoped.

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

### Household-scoped routes (preferred)

All require an active household membership. Non-members and nonexistent households receive `404`; malformed IDs receive `400`.

- `GET /households/:householdId/events` — list events.
- `GET /households/:householdId/events/range?start=<iso>&end=<iso>` — events in a date range.
- `GET /households/:householdId/events/upcoming` — upcoming events.
- `GET /households/:householdId/events/bills/unpaid` — unpaid bills.
- `GET /households/:householdId/events/:eventId` — one event.
- `POST /households/:householdId/events` — requires `title` and `startDate`. `householdId` comes from the route and `createdBy` from the session; body values are ignored.
- `PUT /households/:householdId/events/:eventId` — updates allowed fields only (`title`, `description`, `location`, `eventType`, `startDate`, `endDate`, `allDay`, `billAmount`, `recurring`, `attendees`).
- `PATCH /households/:householdId/events/:eventId/pay` — mark a bill paid.
- `DELETE /households/:householdId/events/:eventId` — delete an event.

Attendees must be active household members. People are returned with `displayName` and `profilePicture` only.

### Legacy routes (deprecated, insecure)

Not household-scoped; removed after the frontend migrates.

### `GET /events`
List all events; results are not filtered by household membership.

### `GET /events/range?start=<iso>&end=<iso>`
List events in date range.

### `GET /events/upcoming`
List upcoming events (limited).

### `GET /events/bills/unpaid`
List unpaid bill events.

### `POST /events`
Create event (creator is current user). If `householdId` is omitted, the route may assign the shared default household. This fallback does not verify membership or provide household isolation.

### `PUT /events/:id`
Update event by ID. The current route accepts unrestricted request fields and does not enforce household membership.

### `PATCH /events/:id/pay`
Mark bill event as paid by ID without checking household membership.

### `DELETE /events/:id`
Delete event by ID without checking household membership.

## Chat (REST history endpoints)

### Household-scoped routes (preferred)

- `GET /households/:householdId/messages` — message history, including legacy `roomId` messages. Senders return `displayName` and `profilePicture` only.
- `POST /households/:householdId/messages` — send `text` (trimmed, max 2000). Optional `relatedType` (`chore` or `expense`) with `relatedId`, which must belong to the same household. Sender and household are set by the server.

Non-members and nonexistent households receive `404`.

### Legacy routes (deprecated)

Use embedded `Household.members` for the membership check, not `HouseholdMembership`.

### `GET /chat/:householdId/chat`
Get household message history.

### `POST /chat/:householdId/chat`
Create household message.

## Socket.IO events

After connecting with auth token:

- Client emits `joinHousehold(householdId)` — requires an active `HouseholdMembership`.
- Client emits `sendMessage({ householdId, text, relatedType?, relatedId? })`
- Server emits `chatMessage` with populated sender
- Server may emit `errorMessage`. Malformed IDs, missing households, and non-members all get the same `Household not found` message.
- `text` is trimmed and limited to 2000 characters; `relatedType`/`relatedId` are validated.

## Rate limits

Configured in server:

- General API: 100 requests / 15 minutes / IP
- Write-heavy routes: 1000 requests / 15 minutes / IP (the server configuration differs from its comment, which says 30)

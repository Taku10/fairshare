# API Reference

Base URL (local default): `http://localhost:5000/api`

All API endpoints require `Authorization: Bearer <firebase-id-token>` unless server dev auth bypass is enabled.

Household-owned resource routes require active membership. Non-members and nonexistent households receive `404`; malformed household IDs receive `400`. Clients must use the active household's scoped routes.

## Households

Household endpoints other than create, list, and join require an active membership. Non-members and nonexistent households receive `404`; malformed IDs receive `400`.

### `POST /households`
Create a household (`name`, up to 100 characters). The creator becomes the owner and receives an invite `code` that expires after 7 days.

### `GET /households`
List households where the current user has an active membership. Members are returned with `displayName`, `email`, and `profilePicture` only. The invite code is included for owners only.

### `GET /households/:householdId`
Get household details (members only). The invite `code` and `codeExpiresAt` are visible to owners only.

### `POST /households/join/:code`
Join a household by invite code. Codes are 10 random characters (case-insensitive) and expire after 7 days. Unknown, malformed, expired, and revoked codes all return the same `404`. Limited to 10 attempts per 15 minutes per IP. Legacy codes without an expiry are rejected; an owner must issue a new one.

### `PUT /households/:householdId`
Rename a household (owner only). Only `name` is accepted.

### `DELETE /households/:householdId`
Delete a household and its memberships (owner only). Existing chores, expenses, events, and messages are not removed.

### `POST /households/:householdId/invite`
Replace the invite code with a new one and return `{ code, codeExpiresAt }` (owner only). The old code stops working.

### `DELETE /households/:householdId/invite`
Revoke the current invite code (owner only).

### `DELETE /households/:householdId/members/:userId`
Remove a member (owner), or leave the household (`userId` is yourself). The owner cannot be removed. The user's account is never deleted.

Household documents continue to use MongoDB's `rooms` collection.

## Roommates

Roommate records are created at sign-in and edited only through `/roommates/me`. The former `POST /roommates`, `PUT /roommates/:id`, and `DELETE /roommates/:id` routes were removed because they let any user create, modify, or delete any account. Use `DELETE /households/:householdId/members/:userId` to remove someone from a household.

### `GET /roommates`
List people who share an active household with the current user (excluding yourself), with `displayName`, `email`, `profilePicture`, and `bio`.

### `GET /roommates/me`
Get current user profile.

### `PUT /roommates/me`
Update current user profile fields (`displayName`, `bio`, `profilePicture`).

## Chores

### Household-scoped routes (preferred)

All require an active household membership. Non-members, and nonexistent households, receive `404`; malformed IDs receive `400`.

- `GET /households/:householdId/chores` — list the household's chores.
- `GET /households/:householdId/chores/:choreId` — get one chore.
- `POST /households/:householdId/chores` — create a chore. Accepts `title`, `description`, `dueDate`, `assignedTo`. `householdId` is always set from the route; a body value is ignored.
- `PUT /households/:householdId/chores/:choreId` — update `title`, `description`, `dueDate`, `assignedTo`, `completed`. `householdId` cannot be changed.
- `DELETE /households/:householdId/chores/:choreId` — delete a chore.

`assignedTo` must be an active member of the household (or `null` to unassign). Lookups, updates, and deletes always include the household filter.

### Legacy routes removed

The unscoped `/chores` endpoints are no longer mounted. Use the household-scoped routes above.

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

### Legacy routes removed

The unscoped `/expenses` endpoints are no longer mounted. Use the household-scoped routes above.

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

### Legacy routes removed

The unscoped `/events` endpoints are no longer mounted. Use the household-scoped routes above.

## Chat (REST history endpoints)

### Household-scoped routes (preferred)

- `GET /households/:householdId/messages` — message history, including legacy `roomId` messages. Senders return `displayName` and `profilePicture` only.
- `POST /households/:householdId/messages` — send `text` (trimmed, max 2000). Optional `relatedType` (`chore` or `expense`) with `relatedId`, which must belong to the same household. Sender and household are set by the server.

Non-members and nonexistent households receive `404`.

### Legacy routes removed

The unscoped `/chat` endpoints are no longer mounted. Use the household-scoped routes above.

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

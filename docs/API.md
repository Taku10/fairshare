# API Reference

Base URL (local default): `http://localhost:5000/api`

All API endpoints require `Authorization: Bearer <firebase-id-token>` unless server dev auth bypass is enabled.

## Households

### `POST /households`
Create a household.

### `GET /households`
List households where the current user is a member.

### `GET /households/:householdId`
Get household details.

### `POST /households/join/:code`
Join a household by invite code.

### `PUT /households/:householdId`
Update a household (creator only).

### `DELETE /households/:householdId`
Delete a household (creator only).

## Roommates

### `POST /roommates`
Create roommate record.

### `GET /roommates`
List roommates excluding current user.

### `GET /roommates/me`
Get current user profile.

### `PUT /roommates/me`
Update current user profile fields (`displayName`, `bio`, `profilePicture`).

### `PUT /roommates/:id`
Update roommate by ID.

### `DELETE /roommates/:id`
Delete roommate by ID.

## Chores

### `POST /chores`
Create a chore associated with a `householdId`.

### `GET /chores`
List chores.

### `PUT /chores/:id`
Update chore fields (`title`, `assignedTo`, `completed`).

### `DELETE /chores/:id`
Delete chore.

## Expenses

### `POST /expenses`
Create expense. Requires valid `description`, positive `amount`, and `paidBy`.
The request may include the owning `householdId`.

### `GET /expenses`
List expenses.

### `PUT /expenses/:id`
Update expense fields (`description`, `amount`, `paidBy`, `splitBetween`).

### `DELETE /expenses/:id`
Delete expense.

### `GET /expenses/balances/summary`
Get current user net balance summary.

## Events

### `GET /events`
List all events.

### `GET /events/range?start=<iso>&end=<iso>`
List events in date range.

### `GET /events/upcoming`
List upcoming events (limited).

### `GET /events/bills/unpaid`
List unpaid bill events.

### `POST /events`
Create event (creator is current user).

### `PUT /events/:id`
Update event.

### `PATCH /events/:id/pay`
Mark bill event as paid.

### `DELETE /events/:id`
Delete event.

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
- Write-heavy routes: 30 requests / 15 minutes / IP

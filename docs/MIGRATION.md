# Household data migration

Moves pre-`v0.3.0` data onto the household model. Run it once per deployment, after deploying the `v0.3.0` code.

## What it does

1. **Backfills `HouseholdMembership`** for every existing household: each entry in `members` becomes a `member`, and `createdBy` becomes the `owner`. Existing memberships are left alone. Without this, current users get `404` from the household-scoped routes and the socket check.
2. **Assigns `householdId`** to chores, expenses, events, and chat messages that lack it, using the household you pass with `--household`.
   - A record that already has a `roomId` keeps that household. If the `roomId` matches no household, the record is reported as failed rather than guessed.
   - Records that already have a `householdId` are skipped and never overwritten.

It does not delete anything, change `Household.members`, or touch user accounts. It is safe to run more than once.

## Steps

1. **Back up MongoDB** (see below) and confirm the backup restores.
2. Deploy the `v0.3.0` server code.
3. Pick the destination household for records that have no owner. Use the existing household that was the shared default (usually named `Default Household`) and copy its `_id`. The script never chooses this for you.
4. **Dry run** (the default, makes no changes):

   ```bash
   cd server
   npm run migrate:households -- --household <householdId>
   ```

   Review the counts. `would update` is what will change, `skipped` is already migrated, and any `failed` line must be understood first.
5. **Apply**:

   ```bash
   npm run migrate:households -- --household <householdId> --apply
   ```

6. **Verify**: re-run the dry run. Every line should show `0 would update` and `0 failed`. Then check in the app that each user can open their household.

The script uses `MONGO_URI` from `server/.env` (or the environment) and exits with a non-zero status if any record failed.

## Backup and rollback

Back up before applying:

```bash
mongodump --uri "$MONGO_URI" --out ./backup-$(date +%Y%m%d-%H%M%S)
```

Rollback restores the backup taken before the migration:

```bash
mongorestore --uri "$MONGO_URI" --drop ./backup-<timestamp>
```

Restoring discards anything written after the backup, so stop writes to the app first. The migration only adds `householdId` values and membership documents, so you can also revert by deploying the previous server image if the data is otherwise healthy.

## After migrating

- The shared default-household fallback is gone, and unscoped `/api/chores`, `/api/expenses`, `/api/events`, and `/api/chat` routes are no longer mounted. Clients must use the household-scoped APIs.
- Legacy `roomId` compatibility remains temporarily for household-owned records.

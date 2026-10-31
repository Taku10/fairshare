const COLLECTIONS = ['chores', 'expenses', 'events', 'chatMessages'];
const OBJECT_ID = /^[a-f\d]{24}$/i;

const isObjectId = (value) => typeof value === 'string' && OBJECT_ID.test(value);

function emptyCounts() {
  return { found: 0, updated: 0, skipped: 0, failed: 0 };
}

async function backfillMemberships(store, apply, report) {
  const households = await store.listHouseholds();
  for (const household of households) {
    const people = new Map();
    for (const member of household.members || []) people.set(String(member), 'member');
    if (household.createdBy) people.set(String(household.createdBy), 'owner');

    for (const [userId, role] of people) {
      try {
        if (await store.hasMembership(household._id, userId)) {
          report.memberships.skipped += 1;
          continue;
        }
        report.memberships.found += 1;
        if (apply) await store.addMembership(household._id, userId, role);
        report.memberships.updated += 1;
      } catch (err) {
        report.memberships.failed += 1;
        report.errors.push(`membership ${household._id}/${userId}: ${err.message}`);
      }
    }
  }
}

async function migrateRecords(store, destinationId, apply, report) {
  for (const collection of COLLECTIONS) {
    const counts = emptyCounts();
    report.records[collection] = counts;
    counts.skipped = await store.countOwned(collection);

    for (const doc of await store.findUnowned(collection)) {
      counts.found += 1;
      try {
        // A chat message that already names a room keeps that room; nothing is guessed.
        let target = destinationId;
        if (doc.roomId) {
          if (!(await store.householdExists(doc.roomId))) {
            throw new Error(`roomId ${doc.roomId} does not match an existing household`);
          }
          target = String(doc.roomId);
        }
        if (apply) {
          const changed = await store.setHousehold(collection, doc._id, target);
          if (!changed) {
            counts.skipped += 1;
            counts.found -= 1;
            continue;
          }
        }
        counts.updated += 1;
      } catch (err) {
        counts.failed += 1;
        report.errors.push(`${collection} ${doc._id}: ${err.message}`);
      }
    }
  }
}

// Dry run (apply=false) reads only and reports what would change.
async function migrate({ store, destinationHouseholdId, apply = false }) {
  if (!isObjectId(destinationHouseholdId)) {
    throw new Error('A valid destination household ID is required (--household <id>)');
  }
  if (!(await store.householdExists(destinationHouseholdId))) {
    throw new Error('Destination household does not exist');
  }

  const report = {
    mode: apply ? 'apply' : 'dry-run',
    destinationHouseholdId,
    memberships: emptyCounts(),
    records: {},
    errors: [],
  };

  await backfillMemberships(store, apply, report);
  await migrateRecords(store, destinationHouseholdId, apply, report);
  return report;
}

function formatReport(report) {
  const lines = [`Mode: ${report.mode}`, `Destination household: ${report.destinationHouseholdId}`];
  const verb = report.mode === 'apply' ? 'updated' : 'would update';
  const row = (label, c) =>
    `${label}: ${c.updated} ${verb}, ${c.skipped} skipped, ${c.failed} failed`;
  lines.push(row('memberships', report.memberships));
  for (const [name, counts] of Object.entries(report.records)) lines.push(row(name, counts));
  for (const error of report.errors) lines.push(`  ! ${error}`);
  return lines.join('\n');
}

module.exports = { migrate, formatReport, isObjectId, COLLECTIONS };

/**
 * One-off migration: convert legacy ObjectId user-id fields to Firebase uid strings.
 *
 * Background (ADR-001 / ADR-002): user identity is the Firebase `uid` (a string).
 * Older docs stored ObjectId values in `user_id` fields, which no longer match
 * uid-string queries after the schema change to `String`.
 *
 * Usage (from backend-agentic/):
 *   npx tsx scripts/backfill-user-ids.ts --dry-run    # report counts, NO writes
 *   npx tsx scripts/backfill-user-ids.ts --confirm    # actually convert
 *
 * Safety / idempotency:
 *   - Defaults to --dry-run and refuses to write unless --confirm is passed.
 *   - Only docs where `user_id` is still a BSON ObjectId ($type: 'objectId')
 *     are touched; conversion uses an atomic aggregation-pipeline update
 *     ($toString), so after a run the field is a string and no longer matches
 *     the filter. Re-running is a no-op.
 *   - Each collection is processed independently; a failure in one is logged
 *     and does not abort the others.
 *
 * Collections: notes_requests, missions, notes_workspaces (converted),
 * chat_histories (verified no-op: already string).
 */
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { logger } from '../src/config/logger.js';
import { NotesRequestModel } from '../src/models/notes-request.model.js';
import { MissionModel } from '../src/models/mission.model.js';
import { NotesWorkspaceModel } from '../src/models/notes-workspace.model.js';
import { ChatHistoryModel } from '../src/models/chat-history.model.js';

interface MigrationModel {
  countDocuments(filter: Record<string, unknown>): Promise<number>;
  updateMany(
    filter: Record<string, unknown>,
    update: unknown[]
  ): Promise<{ matchedCount: number; modifiedCount: number }>;
}

interface MigrationTarget {
  name: string;
  model: MigrationModel;
}

const targets: MigrationTarget[] = [
  { name: 'notes_requests', model: NotesRequestModel as unknown as MigrationModel },
  { name: 'missions', model: MissionModel as unknown as MigrationModel },
  { name: 'notes_workspaces', model: NotesWorkspaceModel as unknown as MigrationModel },
  { name: 'chat_histories', model: ChatHistoryModel as unknown as MigrationModel },
];

const USER_ID_OBJECTID_FILTER: Record<string, unknown> = {
  user_id: { $type: 'objectId' },
};

const CONVERT_TO_STRING: unknown[] = [
  { $set: { user_id: { $toString: '$user_id' } } },
];

async function main(): Promise<void> {
  const dryRun = !process.argv.includes('--confirm');

  await connectDB();
  logger.info(
    { uri: env.MONGODB_URI.replace(/\/\/.*@/, '//***@'), dryRun },
    dryRun
      ? 'Backfill user IDs: DRY-RUN (no writes will be performed)'
      : 'Backfill user IDs: converting legacy ObjectId user_ids to uid strings'
  );

  let totalMatched = 0;
  let totalConverted = 0;
  let totalErrors = 0;

  for (const target of targets) {
    try {
      const matched = await target.model.countDocuments(USER_ID_OBJECTID_FILTER);
      totalMatched += matched;

      let converted = 0;
      if (matched > 0 && !dryRun) {
        const result = await target.model.updateMany(USER_ID_OBJECTID_FILTER, CONVERT_TO_STRING);
        converted = result.modifiedCount;
      }
      totalConverted += converted;

      logger.info(
        { collection: target.name, matched, converted, dryRun },
        dryRun
          ? `Backfill: ${target.name} would convert ${matched} doc(s)`
          : `Backfill: ${target.name} converted ${converted} of ${matched} doc(s)`
      );
    } catch (error) {
      totalErrors += 1;
      logger.error({ err: error, collection: target.name }, `Backfill failed for ${target.name}`);
    }
  }

  logger.info(
    { totalMatched, totalConverted, totalErrors, dryRun },
    dryRun
      ? `Backfill DRY-RUN complete: ${totalMatched} legacy doc(s) would be converted. Run with --confirm to write.`
      : `Backfill complete: ${totalConverted} of ${totalMatched} doc(s) converted (${totalErrors} collection error(s)).`
  );

  await disconnectDB();
}

main().catch(async (error) => {
  logger.error({ err: error }, 'Backfill aborted');
  await disconnectDB();
  process.exitCode = 1;
});
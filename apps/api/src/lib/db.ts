/**
 * Shared Postgres connection for the API layer. Uses the same database
 * as the indexer so both services read/write the same tables.
 *
 * The notifications table is defined here (mirrors the indexer's schema)
 * to avoid a cross-package dependency on @solshare/indexer.
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  pgTable,
  bigserial,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { logger } from './logger.js';

/* ------------------------------------------------------------------ */
/*  Table definitions (mirrors apps/indexer/src/db/schema.ts)         */
/* ------------------------------------------------------------------ */

export const notifications = pgTable(
  'notifications',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    recipient: text('recipient').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    category: text('category').notNull(),
    severity: text('severity').notNull().default('info'),
    read: boolean('read').notNull().default(false),
    actionUrl: text('action_url'),
    actionLabel: text('action_label'),
    arrayId: text('array_id'),
    txHash: text('tx_hash'),
    sourcePagingToken: text('source_paging_token'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (t) => ({
    byRecipient: index('notif_recipient_idx').on(t.recipient, t.read),
    byCategory: index('notif_category_idx').on(t.category),
  }),
);

export type DbNotification = typeof notifications.$inferSelect;
export type DbNotificationInsert = typeof notifications.$inferInsert;

/* ---- arrays (mirrors indexer schema) ---- */

export const arrays = pgTable(
  'arrays',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    operator: text('operator').notNull(),
    location: jsonb('location').notNull(),
    panelCount: integer('panel_count').notNull(),
    panelTech: text('panel_tech').notNull(),
    ratedCapacityW: bigint('rated_capacity_w', { mode: 'bigint' }).notNull(),
    installedAt: timestamp('installed_at', { withTimezone: true }).notNull(),
    status: text('status').notNull(),
    impact: jsonb('impact').notNull(),
    tokenContract: text('token_contract'),
    metadataUri: text('metadata_uri'),
    lastUpdated: timestamp('last_updated', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byStatus: index('arrays_status_idx').on(t.status),
  }),
);

/* ---- bridge_txs (mirrors indexer schema) ---- */

export const bridgeTxs = pgTable(
  'bridge_txs',
  {
    id: text('id').primaryKey(),
    direction: text('direction').notNull(),
    sourceChain: text('source_chain').notNull(),
    sourceTxHash: text('source_tx_hash').notNull(),
    sorobanTxHash: text('soroban_tx_hash'),
    wrappedToken: text('wrapped_token').notNull(),
    amount: text('amount').notNull(),
    sender: text('sender').notNull(),
    recipient: text('recipient').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    blockNumber: bigint('block_number', { mode: 'bigint' }),
    blockConfirmations: integer('block_confirmations'),
    signaturesReceived: integer('signatures_received'),
    signaturesRequired: integer('signatures_required'),
    failureReason: text('failure_reason'),
    ledger: integer('ledger'),
    feeCharged: text('fee_charged'),
    memo: text('memo'),
  },
  (t) => ({
    byStatus: index('bridge_status_idx').on(t.status),
    byChain: index('bridge_chain_idx').on(t.sourceChain),
  }),
);

/* ------------------------------------------------------------------ */
/*  Connection singleton                                                */
/* ------------------------------------------------------------------ */

const schema = { notifications, arrays, bridgeTxs };
type Schema = typeof schema;
let _db: PostgresJsDatabase<Schema> | null = null;

function buildUrl(): string {
  const full = process.env.INDEXER_DATABASE_URL;
  if (full) return full;
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = process.env.POSTGRES_PORT ?? '5432';
  const user = process.env.POSTGRES_USER ?? 'solshare';
  const pass = process.env.POSTGRES_PASSWORD ?? 'solshare';
  const db = process.env.POSTGRES_DB ?? 'solshare';
  return `postgres://${user}:${pass}@${host}:${port}/${db}`;
}

export function getDb(): PostgresJsDatabase<Schema> {
  if (_db) return _db;
  const url = buildUrl();
  const sql = postgres(url, { onnotice: () => {} });
  _db = drizzle(sql, { schema });
  logger.info('api postgres connected');
  return _db;
}

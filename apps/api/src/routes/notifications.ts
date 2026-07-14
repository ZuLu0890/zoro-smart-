import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import type { Notification, NotificationCount, Paginated } from '@solshare/shared';
import { getDb, notifications } from '../lib/db.js';
import { cache } from '../lib/cache.js';
import { logger } from '../lib/logger.js';

const listQuery = z.object({
  address: z.string().min(2),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z.coerce.boolean().default(false),
});

const markReadBody = z.object({
  address: z.string().min(2),
  ids: z.array(z.string()).default([]),
  markAll: z.boolean().default(false),
});

/** Map a DB row to the shared Notification shape. */
function toNotification(row: typeof notifications.$inferSelect): Notification {
  return {
    id: String(row.id),
    title: row.title,
    body: row.body,
    category: row.category as Notification['category'],
    severity: row.severity as Notification['severity'],
    read: row.read,
    actionUrl: row.actionUrl ?? null,
    actionLabel: row.actionLabel ?? null,
    createdAt: Math.floor(new Date(row.createdAt).getTime() / 1000),
    readAt: row.readAt ? Math.floor(new Date(row.readAt).getTime() / 1000) : null,
    arrayId: row.arrayId ?? null,
    txHash: row.txHash ?? null,
  };
}

export async function notificationRoutes(app: FastifyInstance) {
  /** List notifications for an address, newest first. */
  app.get<{ Querystring: { address: string; page?: string; pageSize?: string; unreadOnly?: string } }>(
    '/notifications',
    async (request, reply) => {
      const parse = listQuery.safeParse(request.query);
      if (!parse.success) {
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: parse.error.message } });
      }
      const { address, page, pageSize, unreadOnly } = parse.data;

      const db = getDb();
      const where = unreadOnly
        ? and(eq(notifications.recipient, address), eq(notifications.read, false))
        : eq(notifications.recipient, address);

      const [rows, countResult] = await Promise.all([
        db
          .select()
          .from(notifications)
          .where(where)
          .orderBy(desc(notifications.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(notifications)
          .where(where),
      ]);

      const total = countResult[0]?.total ?? 0;
      const resp: Paginated<Notification> = {
        items: rows.map(toNotification),
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      };
      return resp;
    },
  );

  /** Get unread notification count, broken down by category. */
  app.get<{ Querystring: { address: string } }>(
    '/notifications/count',
    async (request, reply) => {
      const address = (request.query as { address?: string })?.address;
      if (!address) {
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'address required' } });
      }

      const cacheKey = `notif:count:${address}`;
      const cached = await cache.get<NotificationCount>(cacheKey);
      if (cached) return cached;

      const db = getDb();

      // Total notifications for this recipient.
      const [totalRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(notifications)
        .where(eq(notifications.recipient, address));

      // Unread count.
      const [unreadRow] = await db
        .select({ unread: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(eq(notifications.recipient, address), eq(notifications.read, false)));

      // Per-category unread counts.
      const categoryRows = await db
        .select({
          category: notifications.category,
          count: sql<number>`count(*)::int`,
        })
        .from(notifications)
        .where(and(eq(notifications.recipient, address), eq(notifications.read, false)))
        .groupBy(notifications.category);

      const byCategory = {
        yield: 0,
        bridge: 0,
        governance: 0,
        array: 0,
        system: 0,
        wallet: 0,
      } as Record<string, number>;

      for (const row of categoryRows) {
        if (row.category in byCategory) {
          byCategory[row.category] = row.count;
        }
      }

      const resp: NotificationCount = {
        total: totalRow?.total ?? 0,
        unread: unreadRow?.unread ?? 0,
        byCategory: byCategory as NotificationCount['byCategory'],
      };

      await cache.set(cacheKey, resp, 15);
      return resp;
    },
  );

  /** Mark specific notifications (or all) as read for a recipient. */
  app.post('/notifications/read', async (request, reply) => {
    const parse = markReadBody.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: parse.error.message } });
    }
    const { address, ids, markAll } = parse.data;

    const db = getDb();
    const now = new Date();

    try {
      if (markAll) {
        await db
          .update(notifications)
          .set({ read: true, readAt: now })
          .where(and(eq(notifications.recipient, address), eq(notifications.read, false)));
      } else if (ids.length > 0) {
        const bigintIds = ids
          .map((id) => {
            try {
              return BigInt(id);
            } catch {
              return null;
            }
          })
          .filter((n): n is bigint => n !== null);
        if (bigintIds.length === 0) {
          return { status: 'ok', marked: 0 };
        }
        await db
          .update(notifications)
          .set({ read: true, readAt: now })
          .where(
            and(
              inArray(notifications.id, bigintIds),
              eq(notifications.recipient, address),
            ),
          );
      }

      // Invalidate the count cache.
      await cache.del(`notif:count:${address}`);

      logger.info(
        { address, markAll, idsCount: ids.length },
        'notifications marked read',
      );

      return { status: 'ok' };
    } catch (err) {
      logger.error({ err }, 'mark notifications read failed');
      return reply.code(500).send({ error: { code: 'DB_ERROR', message: 'Failed to update notifications' } });
    }
  });
}

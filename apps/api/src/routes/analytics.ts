import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql, desc, eq, gte, and } from 'drizzle-orm';
import type {
  VolumeAnalytics,
  TopArraysResponse,
  YieldProjection,
} from '@solshare/shared';
import { getDb, arrays, bridgeTxs } from '../lib/db.js';
import { getClient } from '../lib/stellar.js';
import { cache } from '../lib/cache.js';

const volumeQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const topQuery = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
  sort: z.enum(['capacity', 'yield']).default('yield'),
});

export async function analyticsRoutes(app: FastifyInstance) {
  /** Bridge volume analytics — aggregated from indexed bridge_txs. */
  app.get<{ Querystring: { days?: string } }>(
    '/analytics/volume',
    async (request) => {
      const parse = volumeQuery.safeParse(request.query);
      if (!parse.success) throw new Error(parse.error.message);
      const { days } = parse.data;
      const cacheKey = `analytics:volume:${days}`;
      const cached = await cache.get<VolumeAnalytics>(cacheKey);
      if (cached) return cached;

      const db = getDb();
      const cutoff = new Date(Date.now() - days * 86400 * 1000);

      // Total wraps / unwraps + aggregate amount.
      const [totals] = await db
        .select({
          totalWraps: sql<number>`count(*) filter (where ${eq(bridgeTxs.direction, 'wrap')})::int`,
          totalUnwraps: sql<number>`count(*) filter (where ${eq(bridgeTxs.direction, 'unwrap')})::int`,
          totalVolume: sql<string>`coalesce(sum(${sql.raw('amount::numeric')})::text, '0')`,
        })
        .from(bridgeTxs)
        .where(
          and(
            gte(bridgeTxs.createdAt, cutoff),
            eq(bridgeTxs.status, 'minted'),
          ),
        );

      // Daily volume breakdown.
      const dailyRows = await db
        .select({
          date: sql<string>`to_char(${bridgeTxs.createdAt}, 'YYYY-MM-DD')`,
          volume: sql<string>`coalesce(sum(${sql.raw('amount::numeric')})::text, '0')`,
          wraps: sql<number>`count(*) filter (where ${eq(bridgeTxs.direction, 'wrap')})::int`,
          unwraps: sql<number>`count(*) filter (where ${eq(bridgeTxs.direction, 'unwrap')})::int`,
        })
        .from(bridgeTxs)
        .where(
          and(
            gte(bridgeTxs.createdAt, cutoff),
            eq(bridgeTxs.status, 'minted'),
          ),
        )
        .groupBy(sql`to_char(${bridgeTxs.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${bridgeTxs.createdAt}, 'YYYY-MM-DD')`);

      // Top chains by volume.
      const chainRows = await db
        .select({
          chain: bridgeTxs.sourceChain,
          volume: sql<string>`coalesce(sum(${sql.raw('amount::numeric')})::text, '0')`,
          count: sql<number>`count(*)::int`,
        })
        .from(bridgeTxs)
        .where(
          and(
            gte(bridgeTxs.createdAt, cutoff),
            eq(bridgeTxs.status, 'minted'),
          ),
        )
        .groupBy(bridgeTxs.sourceChain)
        .orderBy(desc(sql`sum(${sql.raw('amount::numeric')})`))
        .limit(10);

      const totalVolume = totals?.totalVolume ?? '0';
      const totalVolumeNum = Number(totalVolume);

      const resp: VolumeAnalytics = {
        totalBridgeVolumeUsdc: totalVolume,
        totalWraps: totals?.totalWraps ?? 0,
        totalUnwraps: totals?.totalUnwraps ?? 0,
        daily: dailyRows.map((r) => ({
          date: r.date,
          volume: r.volume,
          wraps: r.wraps,
          unwraps: r.unwraps,
        })),
        topChains: chainRows.map((r) => ({
          chain: r.chain,
          volume: r.volume,
          percentage: totalVolumeNum > 0 ? (Number(r.volume) / totalVolumeNum) * 100 : 0,
        })),
        days,
      };
      await cache.set(cacheKey, resp, 30);
      return resp;
    },
  );

  /** Top-performing arrays — sorted via indexed Postgres ORDER BY. */
  app.get<{ Querystring: { limit?: string; sort?: string } }>(
    '/analytics/top-arrays',
    async (request) => {
      const parse = topQuery.safeParse(request.query);
      if (!parse.success) throw new Error(parse.error.message);
      const { limit, sort } = parse.data;
      const cacheKey = `analytics:top-arrays:${sort}:${limit}`;
      const cached = await cache.get<TopArraysResponse>(cacheKey);
      if (cached) return cached;

      const db = getDb();

      // Pick the ORDER BY column.
      const orderCol =
        sort === 'capacity'
          ? arrays.ratedCapacityW
          : sql`(${arrays.impact}->>'expectedYieldKwhPerYear')::bigint`;

      const rows = await db
        .select({
          id: arrays.id,
          name: arrays.name,
          status: arrays.status,
          ratedCapacityW: arrays.ratedCapacityW,
          tokenContract: arrays.tokenContract,
          impact: arrays.impact,
        })
        .from(arrays)
        .orderBy(desc(orderCol))
        .limit(limit);

      const entries = rows.map((row) => {
        const imp = row.impact as { co2OffsetKgPerYear?: number; expectedYieldKwhPerYear?: number } | null;
        return {
          id: row.id,
          name: row.name,
          status: row.status,
          ratedCapacityW: Number(row.ratedCapacityW),
          yieldPerShare: '0',
          totalShares: '0',
          co2OffsetKgPerYear: imp?.co2OffsetKgPerYear ?? 0,
        };
      });

      const resp: TopArraysResponse = {
        entries,
        sortBy: sort,
        limit,
      };
      await cache.set(cacheKey, resp, 30);
      return resp;
    },
  );

  /** Yield projection for an array — reads from chain via SDK. */
  app.get<{ Querystring: { arrayId: string; shares?: string; months?: string } }>(
    '/analytics/yield-projection',
    async (request, reply) => {
      const arrayId = (request.query as { arrayId?: string })?.arrayId;
      const shares = (request.query as { shares?: string })?.shares ?? '100';
      const months = Number((request.query as { months?: string })?.months ?? '12');

      if (!arrayId) {
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'arrayId required' } });
      }

      const client = getClient();
      const arr = await client.registry.getArray(arrayId).catch(() => null);

      const expectedKwh = arr?.impact?.expectedYieldKwhPerYear ?? 0;
      const monthlyKwh = expectedKwh / 12;
      const projected = Array.from({ length: months }, (_, i) => ({
        month: i + 1,
        label: `Month ${i + 1}`,
        projectedYield: String(Math.round(monthlyKwh * 1000)),
        cumulativeYield: String(Math.round(monthlyKwh * (i + 1) * 1000)),
      }));

      const resp: YieldProjection = {
        arrayId,
        shares,
        months,
        monthlyKwhEstimate: Math.round(monthlyKwh),
        annualKwhEstimate: expectedKwh,
        projected,
      };
      return resp;
    },
  );
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { or, ilike } from 'drizzle-orm';
import type { SearchResponse } from '@solshare/shared';
import { getDb, arrays } from '../lib/db.js';
import { getClient } from '../lib/stellar.js';
import { cache } from '../lib/cache.js';

const searchQuery = z.object({
  q: z.string().min(1).max(200),
  types: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function searchRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { q: string; types?: string; limit?: string } }>(
    '/search',
    async (request, reply) => {
      const parse = searchQuery.safeParse(request.query);
      if (!parse.success) {
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: parse.error.message } });
      }
      const { q, types, limit } = parse.data;
      const typeList = types?.split(',').filter(Boolean) ?? [];
      const cacheKey = `search:${q}:${typeList.join(',')}:${limit}`;
      const cached = await cache.get<SearchResponse>(cacheKey);
      if (cached) return cached;

      const start = Date.now();
      const searchPattern = `%${q}%`;
      const results: SearchResponse['results'] = [];

      // Search arrays via indexed Postgres ILIKE queries.
      const includeArrays = typeList.length === 0 || typeList.includes('array');
      if (includeArrays) {
        const db = getDb();
        const arrayRows = await db
          .select({
            id: arrays.id,
            name: arrays.name,
            operator: arrays.operator,
            ratedCapacityW: arrays.ratedCapacityW,
            status: arrays.status,
          })
          .from(arrays)
          .where(
            or(
              ilike(arrays.name, searchPattern),
              ilike(arrays.id, searchPattern),
              ilike(arrays.operator, searchPattern),
            ),
          )
          .limit(limit);

        for (const row of arrayRows) {
          results.push({
            id: row.id,
            type: 'array',
            title: row.name,
            subtitle: `${Number(row.ratedCapacityW)}W · ${row.status}`,
            url: `/arrays/${row.id}`,
            status: row.status,
            score: 0.9,
          });
        }
      }

      // Search proposals via governance SDK (governance not yet indexed in Postgres).
      const includeProposals = typeList.length === 0 || typeList.includes('proposal');
      const proposalSlots = limit - results.length;
      if (includeProposals && proposalSlots > 0) {
        const client = getClient();
        const proposals = await client.governance.listProposals({ page: 1, pageSize: limit }).catch(() => ({ items: [], total: 0 }));
        const matched = proposals.items
          .filter(
            (p) =>
              p.title.toLowerCase().includes(q.toLowerCase()) ||
              p.description.toLowerCase().includes(q.toLowerCase()),
          )
          .slice(0, proposalSlots)
          .map((p) => ({
            id: p.id,
            type: 'proposal' as const,
            title: p.title,
            subtitle: `By ${p.proposer.slice(0, 8)}… · ${p.status}`,
            url: `/governance/${p.id}`,
            status: p.status,
            score: 0.7,
          }));
        results.push(...matched);
      }

      const resp: SearchResponse = {
        query: q,
        results,
        total: results.length,
        tookMs: Date.now() - start,
      };
      await cache.set(cacheKey, resp, 15);
      return resp;
    },
  );
}

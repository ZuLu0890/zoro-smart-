import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SearchResponse } from '@solshare/shared';
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

      const client = getClient();
      const start = Date.now();

      // Search across arrays via the registry.
      const arrays = await client.registry.getAllArrays().catch(() => []);
      const arrayResults = arrays
        .filter(
          (a) =>
            a.name.toLowerCase().includes(q.toLowerCase()) ||
            a.id.toLowerCase().includes(q.toLowerCase()) ||
            a.operator.toLowerCase().includes(q.toLowerCase()),
        )
        .slice(0, limit)
        .map((a) => ({
          id: a.id,
          type: 'array' as const,
          title: a.name,
          subtitle: `${a.ratedCapacityW}W · ${a.status}`,
          url: `/arrays/${a.id}`,
          status: a.status,
          score: 0.9,
        }));

      // Search proposals from governance.
      const proposals = await client.governance.listProposals({ page: 1, pageSize: limit }).catch(() => ({ items: [], total: 0 }));
      const proposalResults = proposals.items
        .filter(
          (p) =>
            p.title.toLowerCase().includes(q.toLowerCase()) ||
            p.description.toLowerCase().includes(q.toLowerCase()),
        )
        .slice(0, limit)
        .map((p) => ({
          id: p.id,
          type: 'proposal' as const,
          title: p.title,
          subtitle: `By ${p.proposer.slice(0, 8)}… · ${p.status}`,
          url: `/governance/${p.id}`,
          status: p.status,
          score: 0.7,
        }));

      const results = [...arrayResults, ...proposalResults].slice(0, limit);

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

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { GovernanceProposal, ProposalTally, GovernanceStats, Paginated } from '@solshare/shared';
import { getClient } from '../lib/stellar.js';
import { cache } from '../lib/cache.js';
import { logger } from '../lib/logger.js';

const listQuery = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createProposalBody = z.object({
  title: z.string().min(3).max(140),
  description: z.string().min(20).max(5000),
  proposalType: z.string(),
  arrayId: z.string().nullable().optional(),
  payload: z.record(z.unknown()).default({}),
  proposer: z.string().min(2),
});

const castVoteBody = z.object({
  proposalId: z.string().min(2),
  voter: z.string().min(2),
  choice: z.enum(['For', 'Against', 'Abstain']),
});

export async function governanceRoutes(app: FastifyInstance) {
  /** List proposals with optional status filter. */
  app.get<{ Querystring: { status?: string; page?: string; pageSize?: string } }>(
    '/governance/proposals',
    async (request) => {
      const parse = listQuery.safeParse(request.query);
      if (!parse.success) throw new Error(parse.error.message);
      const { status, page, pageSize } = parse.data;
      const cacheKey = `gov:proposals:${status ?? 'all'}:${page}:${pageSize}`;
      const cached = await cache.get<Paginated<GovernanceProposal>>(cacheKey);
      if (cached) return cached;

      const client = getClient();
      const result = await client.governance.listProposals({ status, page, pageSize }).catch(() => ({ items: [], total: 0 }));
      const resp: Paginated<GovernanceProposal> = {
        items: result.items,
        total: result.total,
        page,
        pageSize,
        hasMore: page * pageSize < result.total,
      };
      await cache.set(cacheKey, resp, 15);
      return resp;
    },
  );

  /** Get a single proposal by ID. */
  app.get<{ Params: { id: string } }>('/governance/proposals/:id', async (request, reply) => {
    const { id } = request.params;
    const client = getClient();
    const proposal = await client.governance.getProposal(id);
    if (!proposal) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Proposal not found' } });
    }
    return proposal;
  });

  /** Get tally for a proposal. */
  app.get<{ Params: { id: string } }>('/governance/proposals/:id/tally', async (request, reply) => {
    const { id } = request.params;
    const client = getClient();
    const tally = await client.governance.getTally(id).catch(() => null);
    if (!tally) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tally not found' } });
    }
    return tally;
  });

  /** Get a voter's vote on a proposal. */
  app.get<{ Params: { id: string; voter: string } }>(
    '/governance/proposals/:id/votes/:voter',
    async (request, reply) => {
      const { id, voter } = request.params;
      const client = getClient();
      const vote = await client.governance.getVote(id, voter).catch(() => null);
      if (!vote) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Vote not found' } });
      }
      return vote;
    },
  );

  /** Get governance-wide statistics. */
  app.get('/governance/stats', async () => {
    const cached = await cache.get<GovernanceStats>('gov:stats');
    if (cached) return cached;
    const resp: GovernanceStats = {
      totalProposals: 0,
      activeProposals: 0,
      totalVoters: 0,
      totalVotingPowerDelegated: '0',
      participationRate: 0,
    };
    await cache.set('gov:stats', resp, 30);
    return resp;
  });

  /** Create a new proposal (returns the Soroban transaction operation). */
  app.post('/governance/proposals', async (request, reply) => {
    const parse = createProposalBody.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: parse.error.message } });
    }
    const body = parse.data;
    logger.info({ title: body.title, proposer: body.proposer }, 'proposal creation');
    const client = getClient();
    try {
      const op = await client.governance.buildCreateProposal({
        title: body.title,
        description: body.description,
        proposalType: body.proposalType,
        arrayId: body.arrayId ?? null,
        payload: body.payload,
        proposer: body.proposer,
      });
      return { operation: op, status: 'ready' };
    } catch (err) {
      logger.error({ err }, 'buildCreateProposal failed');
      return reply.code(500).send({ error: { code: 'TX_BUILD_FAILED', message: 'Failed to build proposal TX' } });
    }
  });

  /** Cast a vote on a proposal. */
  app.post('/governance/vote', async (request, reply) => {
    const parse = castVoteBody.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: parse.error.message } });
    }
    const body = parse.data;
    logger.info({ proposal: body.proposalId, voter: body.voter, choice: body.choice }, 'vote cast');
    const client = getClient();
    try {
      const op = client.governance.buildCastVote(body.proposalId, body.voter, body.choice);
      return { operation: op, status: 'ready' };
    } catch (err) {
      logger.error({ err }, 'buildCastVote failed');
      return reply.code(500).send({ error: { code: 'TX_BUILD_FAILED', message: 'Failed to build vote TX' } });
    }
  });

  /** Execute a passed proposal. */
  app.post('/governance/proposals/:id/execute', async (request, reply) => {
    const { id } = request.params as { id: string };
    const client = getClient();
    try {
      const op = client.governance.buildExecuteProposal(id);
      return { operation: op, status: 'ready' };
    } catch (err) {
      logger.error({ err }, 'buildExecuteProposal failed');
      return reply.code(500).send({ error: { code: 'TX_BUILD_FAILED', message: 'Failed to build execution TX' } });
    }
  });
}

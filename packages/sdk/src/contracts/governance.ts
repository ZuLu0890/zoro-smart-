import { ContractClient } from './contract-client.js';
import type { SimulationAccount } from '../simulation-account.js';
import type {
  GovernanceProposal,
  ProposalVote,
  ProposalTally,
  GovernanceConfig,
  VoteChoice,
} from '@solshare/shared';

/**
 * Client for the SolShare governance contract.
 * Handles proposal creation, voting, and execution on Soroban.
 */
export class GovernanceClient {
  private readonly client: ContractClient;
  readonly contractId: string;

  constructor(
    contractId: string,
    sorobanRpcUrl: string,
    networkPassphrase: string,
    simulationAccount: SimulationAccount,
  ) {
    this.contractId = contractId;
    this.client = new ContractClient({
      contractId,
      sorobanRpcUrl,
      networkPassphrase,
      simulationAccount,
    });
  }

  setSimulationAccount(account: SimulationAccount): void {
    this.client.setSimulationAccount(account);
  }

  /** Retrieve the current governance configuration. */
  async getConfig(): Promise<GovernanceConfig> {
    return this.client.read<GovernanceConfig>('get_config');
  }

  /** Fetch a single proposal by id. */
  async getProposal(proposalId: string): Promise<GovernanceProposal | null> {
    if (!this.contractId) return null;
    try {
      return await this.client.read<GovernanceProposal>('get_proposal', { proposal_id: proposalId });
    } catch {
      return null;
    }
  }

  /** List proposals with optional status filter and pagination. */
  async listProposals(params: {
    status?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ items: GovernanceProposal[]; total: number }> {
    return this.client.read<{ items: GovernanceProposal[]; total: number }>('list_proposals', {
      status: params.status ?? null,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20,
    });
  }

  /** Get vote tally for a proposal. */
  async getTally(proposalId: string): Promise<ProposalTally> {
    return this.client.read<ProposalTally>('get_tally', { proposal_id: proposalId });
  }

  /** Get a specific voter's vote on a proposal. */
  async getVote(proposalId: string, voter: string): Promise<ProposalVote | null> {
    if (!this.contractId) return null;
    try {
      return await this.client.read<ProposalVote>('get_vote', {
        proposal_id: proposalId,
        voter,
      });
    } catch {
      return null;
    }
  }

  /** Check if a voter has already voted on a proposal. */
  async hasVoted(proposalId: string, voter: string): Promise<boolean> {
    return this.client.read<boolean>('has_voted', {
      proposal_id: proposalId,
      voter,
    });
  }

  /** Build a cast-vote transaction for submission. */
  buildCastVote(
    proposalId: string,
    voter: string,
    choice: VoteChoice,
  ) {
    return this.client.buildWrite('cast_vote', {
      proposal_id: proposalId,
      voter,
      choice,
    });
  }

  /** Build a create-proposal transaction. */
  buildCreateProposal(params: {
    title: string;
    description: string;
    proposalType: string;
    arrayId: string | null;
    payload: Record<string, unknown>;
    proposer: string;
  }) {
    return this.client.buildWrite('create_proposal', params);
  }

  /** Build an execute-proposal transaction. */
  buildExecuteProposal(proposalId: string) {
    return this.client.buildWrite('execute_proposal', {
      proposal_id: proposalId,
    });
  }
}

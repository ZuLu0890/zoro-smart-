export type ProposalStatus = 'Draft' | 'Active' | 'Passed' | 'Rejected' | 'Executed' | 'Cancelled';

export type ProposalType =
  | 'ParameterChange'
  | 'OperatorUpdate'
  | 'FeeUpdate'
  | 'MaintenanceSchedule'
  | 'ArrayExpansion'
  | 'TreasuryAllocation'
  | 'General';

export type VoteChoice = 'For' | 'Against' | 'Abstain';

export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  proposalType: ProposalType;
  arrayId: string | null;
  proposer: string;
  status: ProposalStatus;
  votingStartAt: number;
  votingEndAt: number;
  createdAt: number;
  executedAt: number | null;
  /** Changes proposed as key-value JSON blob. */
  payload: Record<string, unknown>;
}

export interface ProposalVote {
  proposalId: string;
  voter: string;
  choice: VoteChoice;
  votingPower: string;
  votedAt: number;
  txHash: string;
}

export interface ProposalTally {
  proposalId: string;
  totalVotesFor: string;
  totalVotesAgainst: string;
  totalVotesAbstain: string;
  totalVotingPower: string;
  quorum: string;
  threshold: string;
  /** Fraction of voting power that voted "for" (0-1). */
  support: number;
}

export interface GovernanceConfig {
  minProposalThreshold: string;
  votingPeriodSeconds: number;
  executionDelaySeconds: number;
  quorumPercent: number;
  passThresholdPercent: number;
}

export interface GovernanceStats {
  totalProposals: number;
  activeProposals: number;
  totalVoters: number;
  totalVotingPowerDelegated: string;
  participationRate: number;
}

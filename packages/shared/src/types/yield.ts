export interface YieldDistribution {
  distributorId: string;
  shareToken: string;
  paymentToken: string;
  totalFunded: string;
  totalClaimed: string;
  yieldPerShare: string;
  lastFundedAt: number;
  funder: string;
  /** Whether claims are currently paused. */
  paused: boolean;
  /** Minimum claimable amount threshold. */
  minClaimAmount: string;
  /** Number of funding events processed. */
  fundingCount: number;
}

export interface YieldClaim {
  holder: string;
  distributorId: string;
  amount: string;
  paymentToken: string;
  txHash: string;
  claimedAt: number;
}

export interface HolderYield {
  holder: string;
  distributorId: string;
  shares: string;
  claimable: string;
  paidYieldPerShare: string;
  globalYieldPerShare: string;
}

export interface YieldBatchItem {
  holder: string;
  claimable: string;
  claimed: string;
}

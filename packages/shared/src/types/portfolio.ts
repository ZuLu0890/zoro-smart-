export interface PortfolioHolding {
  arrayId: string;
  arrayName: string;
  tokenContract: string;
  balance: string;
  sharePercentage: number;
  valueUsdc: string;
  claimableYield: string;
  claimedYield: string;
  yieldPerShare: string;
  capacityW: number;
  status: string;
}

export interface PortfolioSummary {
  holder: string;
  totalArrays: number;
  totalShares: string;
  totalValueUsdc: string;
  totalClaimableYield: string;
  totalClaimedYield: string;
  holdings: PortfolioHolding[];
  /** Timestamp of last portfolio update. */
  lastUpdated: number;
}

export interface PortfolioTransaction {
  id: string;
  type: 'buy' | 'sell' | 'claim' | 'transfer_in' | 'transfer_out';
  arrayId: string;
  tokenContract: string;
  amount: string;
  valueUsdc: string;
  txHash: string;
  timestamp: number;
  counterparty?: string;
}

export interface PortfolioAnalytics {
  holder: string;
  totalInvested: string;
  totalEarned: string;
  roi: number;
  bestPerforming: PortfolioHolding | null;
  worstPerforming: PortfolioHolding | null;
  yieldHistory: { label: string; value: string }[];
}

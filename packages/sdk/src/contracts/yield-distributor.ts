import { ContractClient } from './contract-client.js';
import type { SimulationAccount } from '../simulation-account.js';

export class YieldDistributorContract {
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

  async yieldPerShare(): Promise<string> {
    return this.client.read<string>('yield_per_share');
  }

  async claimable(holder: string): Promise<string> {
    return this.client.read<string>('claimable', { holder });
  }

  async lastFundedAt(): Promise<number> {
    const out = await this.client.read<number>('last_funded_at');
    return Number(out);
  }

  async funder(): Promise<string> {
    return this.client.read<string>('funder');
  }

  async totalClaimed(): Promise<string> {
    return this.client.read<string>('total_claimed');
  }

  async totalFunded(): Promise<string> {
    return this.client.read<string>('total_funded');
  }

  async fundingCount(): Promise<number> {
    const out = await this.client.read<number>('funding_count');
    return Number(out);
  }

  async isPaused(): Promise<boolean> {
    return this.client.read<boolean>('paused');
  }

  async minClaim(): Promise<string> {
    return this.client.read<string>('min_claim');
  }

  async shareToken(): Promise<string> {
    return this.client.read<string>('share_token');
  }

  async paymentToken(): Promise<string> {
    return this.client.read<string>('payment_token');
  }

  buildFund(from: string, amount: string) {
    return this.client.buildWrite('fund', { from, amount });
  }

  buildClaim(holder: string) {
    return this.client.buildWrite('claim', { holder });
  }

  buildPause() {
    return this.client.buildWrite('pause', {});
  }

  buildUnpause() {
    return this.client.buildWrite('unpause', {});
  }

  buildSetAdmin(newAdmin: string) {
    return this.client.buildWrite('set_admin', { new_admin: newAdmin });
  }

  buildSetFunder(newFunder: string) {
    return this.client.buildWrite('set_funder', { new_funder: newFunder });
  }

  buildSetShareToken(newToken: string) {
    return this.client.buildWrite('set_share_token', { new_token: newToken });
  }

  buildSetMinClaim(minAmount: string) {
    return this.client.buildWrite('set_min_claim', { min_amount: minAmount });
  }

  buildWithdrawSurplus(to: string, amount: string) {
    return this.client.buildWrite('withdraw_surplus', { to, amount });
  }
}

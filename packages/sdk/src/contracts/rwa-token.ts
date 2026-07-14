import { ContractClient, type ContractClientOptions } from './contract-client.js';
import type { SimulationAccount } from '../simulation-account.js';

export class RwaTokenContract {
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

  async readTotalSupply(): Promise<string> {
    return this.client.read<string>('total_supply');
  }

  async readBalance(account: string): Promise<string> {
    return this.client.read<string>('balance', { account });
  }

  async readAllowance(owner: string, spender: string): Promise<string> {
    return this.client.read<string>('allowance', { owner, spender });
  }

  async readMetadata() {
    const [name, symbol, decimals] = await Promise.all([
      this.client.read<string>('name'),
      this.client.read<string>('symbol'),
      this.client.read<number>('decimals'),
    ]);
    return { name, symbol, decimals: Number(decimals) };
  }

  // --- Compliance & admin reads ---

  async isFrozen(account: string): Promise<boolean> {
    return this.client.read<boolean>('is_frozen', { account });
  }

  async isPaused(): Promise<boolean> {
    return this.client.read<boolean>('paused');
  }

  async supplyCap(): Promise<string> {
    return this.client.read<string>('supply_cap');
  }

  // --- Builders ---

  buildTransfer(from: string, to: string, amount: string) {
    return this.client.buildWrite('transfer', { from, to, amount });
  }

  buildApprove(
    owner: string,
    spender: string,
    amount: string,
    expirationLedger: number,
  ) {
    return this.client.buildWrite('approve', {
      owner,
      spender,
      amount,
      expiration_ledger: expirationLedger,
    });
  }

  buildMint(to: string, amount: string) {
    return this.client.buildWrite('mint', { to, amount });
  }

  buildBurn(from: string, amount: string) {
    return this.client.buildWrite('burn', { from, amount });
  }

  buildFreeze(account: string) {
    return this.client.buildWrite('freeze_account', { account });
  }

  buildUnfreeze(account: string) {
    return this.client.buildWrite('unfreeze_account', { account });
  }

  buildClawback(from: string, amount: string) {
    return this.client.buildWrite('clawback', { from, amount });
  }

  buildPause() {
    return this.client.buildWrite('pause', {});
  }

  buildUnpause() {
    return this.client.buildWrite('unpause', {});
  }

  buildSetSupplyCap(cap: string) {
    return this.client.buildWrite('set_supply_cap', { cap });
  }

  buildSetAdmin(newAdmin: string) {
    return this.client.buildWrite('set_admin', { new_admin: newAdmin });
  }

  buildSetOperator(newOperator: string) {
    return this.client.buildWrite('set_operator', { new_operator: newOperator });
  }

  buildBurnFrom(from: string, amount: string) {
    return this.client.buildWrite('burn_from', { from, amount });
  }

  buildTransferBatch(from: string, recipients: string[], amounts: string[]) {
    return this.client.buildWrite('transfer_batch', { from, recipients, amounts });
  }

  buildTransferFrom(spender: string, owner: string, to: string, amount: string) {
    return this.client.buildWrite('transfer_from', { spender, owner, to, amount });
  }
}

export type { ContractClientOptions };

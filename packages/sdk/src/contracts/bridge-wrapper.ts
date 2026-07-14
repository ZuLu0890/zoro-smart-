import { ContractClient } from './contract-client.js';
import type { SimulationAccount } from '../simulation-account.js';

export interface DepositMessageInput {
  chainId: number;
  sourceTxHash: string;
  sourceToken: string;
  sender: string;
  recipient: string;
  amount: string;
  nonce: number;
}

export interface SolverSignatureInput {
  validator: string;
  signature: string;
}

export class BridgeWrapperContract {
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

  async getValidators(chainId: number): Promise<string[]> {
    return this.client.read<string[]>('get_validators', { chain_id: chainId });
  }

  async getThreshold(chainId: number): Promise<number> {
    const out = await this.client.read<number>('get_threshold', { chain_id: chainId });
    return Number(out);
  }

  async chainInfo(chainId: number): Promise<{ validators: string[]; threshold: number; active: boolean }> {
    return this.client.read<{ validators: string[]; threshold: number; active: boolean }>(
      'chain_info',
      { chain_id: chainId },
    );
  }

  async getWrappedToken(chainId: number, sourceToken: string): Promise<string> {
    return this.client.read<string>('get_wrapped_token', {
      chain_id: chainId,
      source_token: sourceToken,
    });
  }

  async totalMinted(wrappedToken: string): Promise<string> {
    return this.client.read<string>('total_minted', { wrapped_token: wrappedToken });
  }

  async totalBurned(wrappedToken: string): Promise<string> {
    return this.client.read<string>('total_burned', { wrapped_token: wrappedToken });
  }

  async isPaused(): Promise<boolean> {
    return this.client.read<boolean>('paused');
  }

  buildWrap(deposit: DepositMessageInput, signatures: SolverSignatureInput[]) {
    return this.client.buildWrite('wrap', {
      deposit: {
        chain_id: deposit.chainId,
        source_tx_hash: deposit.sourceTxHash,
        source_token: deposit.sourceToken,
        sender: deposit.sender,
        recipient: deposit.recipient,
        amount: deposit.amount,
        nonce: deposit.nonce,
      },
      signatures,
    });
  }

  buildUnwrap(sender: string, request: { chainId: number; recipient: string; amount: string; nonce: number }) {
    return this.client.buildWrite('unwrap', {
      sender,
      request: {
        chain_id: request.chainId,
        recipient: request.recipient,
        amount: request.amount,
        nonce: request.nonce,
      },
    });
  }

  buildSetAdmin(newAdmin: string) {
    return this.client.buildWrite('set_admin', { new_admin: newAdmin });
  }

  buildPause() {
    return this.client.buildWrite('pause', {});
  }

  buildUnpause() {
    return this.client.buildWrite('unpause', {});
  }

  buildSetChainActive(chainId: number, active: boolean) {
    return this.client.buildWrite('set_chain_active', { chain_id: chainId, active });
  }

  buildRemoveValidator(chainId: number, validator: string) {
    return this.client.buildWrite('remove_validator', { chain_id: chainId, validator });
  }

  buildUpdateThreshold(chainId: number, newThreshold: number) {
    return this.client.buildWrite('update_threshold', {
      chain_id: chainId,
      new_threshold: newThreshold,
    });
  }

  buildUnbindToken(chainId: number, sourceToken: string) {
    return this.client.buildWrite('unbind_token', {
      chain_id: chainId,
      source_token: sourceToken,
    });
  }

  buildBindToken(chainId: number, sourceToken: string, wrappedToken: string) {
    return this.client.buildWrite('bind_token', {
      chain_id: chainId,
      source_token: sourceToken,
      wrapped_token: wrappedToken,
    });
  }
}

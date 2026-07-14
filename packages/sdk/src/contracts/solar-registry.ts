import { ContractClient } from './contract-client.js';
import type { SimulationAccount } from '../simulation-account.js';
import type { SolarArraySummary, MaintenanceEvent } from '@solshare/shared';

export class SolarRegistryContract {
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

  async count(): Promise<number> {
    const out = await this.client.read<number>('count_arrays');
    return Number(out);
  }

  async listAllIds(): Promise<string[]> {
    return this.client.read<string[]>('list_arrays');
  }

  async getArray(id: string): Promise<SolarArraySummary | null> {
    if (!this.contractId) return null;
    try {
      const out = (await this.client.read<SolarArraySummary>('get_array', { id })) as SolarArraySummary;
      return out;
    } catch {
      return null;
    }
  }

  async getAllArrays(): Promise<SolarArraySummary[]> {
    const ids = await this.listAllIds();
    const settled = await Promise.all(ids.map((id) => this.getArray(id)));
    return settled.filter((x): x is SolarArraySummary => Boolean(x));
  }

  async getArraysByStatus(status: string): Promise<string[]> {
    return this.client.read<string[]>('get_arrays_by_status', { status });
  }

  async findArraysByOperator(operator: string): Promise<string[]> {
    return this.client.read<string[]>('find_arrays_by_operator', { operator });
  }

  async totalRatedCapacity(): Promise<number> {
    const out = await this.client.read<number>('total_rated_capacity');
    return Number(out);
  }

  async arrayCountByStatus(): Promise<Record<number, number>> {
    return this.client.read<Record<number, number>>('array_count_by_status');
  }

  async getMaintenanceLog(arrayId: string): Promise<MaintenanceEvent[]> {
    return this.client.read<MaintenanceEvent[]>('get_maintenance_log', { array_id: arrayId });
  }

  buildStatusTransition(
    id: string,
    status: 'Active' | 'Maintenance' | 'Decommissioned',
  ) {
    return this.client.buildWrite('set_status', { id, status });
  }

  buildBindToken(id: string, tokenContract: string) {
    return this.client.buildWrite('bind_token', { id, token_contract: tokenContract });
  }

  buildUnbindToken(id: string) {
    return this.client.buildWrite('unbind_token', { array_id: id });
  }

  buildSetAdmin(newAdmin: string) {
    return this.client.buildWrite('set_admin', { new_admin: newAdmin });
  }

  buildSetVerifier(newVerifier: string) {
    return this.client.buildWrite('set_verifier', { new_verifier: newVerifier });
  }

  buildUpdateMetadata(id: string, name: string, metadataUri: string) {
    return this.client.buildWrite('update_array_metadata', {
      array_id: id,
      name,
      metadata_uri: metadataUri,
    });
  }

  buildUpdateLocation(
    id: string,
    location: { latitude: number; longitude: number; altitude_m: number },
  ) {
    return this.client.buildWrite('update_location', { array_id: id, location });
  }

  buildUpdateImpact(
    id: string,
    impact: { co2_offset_kg_per_year: number; expected_yield_kwh_per_year: number },
  ) {
    return this.client.buildWrite('update_environmental_impact', {
      array_id: id,
      impact,
    });
  }

  buildRecordMaintenance(id: string, description: string) {
    return this.client.buildWrite('record_maintenance', {
      array_id: id,
      description,
    });
  }
}

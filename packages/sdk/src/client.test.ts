import { describe, it, expect } from 'vitest';
import { SolShareClient } from '../src/client.js';
import { SimulationAccount } from '../src/simulation-account.js';
import { NETWORK_ENDPOINTS, PROJECT_INFO } from '@solshare/shared';

// A valid Soroban contract strkey (C... 56 chars)
const VALID_CONTRACT = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';

describe('SolShareClient', () => {
  it('creates a testnet client via forTestnet()', () => {
    const client = SolShareClient.forTestnet();
    expect(client.network).toBe('TESTNET');
    expect(client.horizonUrl).toBe(NETWORK_ENDPOINTS.TESTNET.horizon);
    expect(client.sorobanRpcUrl).toBe(NETWORK_ENDPOINTS.TESTNET.sorobanRpc);
  });

  it('creates a mainnet client via forPublic()', () => {
    const client = SolShareClient.forPublic();
    expect(client.network).toBe('PUBLIC');
    expect(client.horizonUrl).toBe(NETWORK_ENDPOINTS.PUBLIC.horizon);
  });

  it('creates a futurenet client via forFuturenet()', () => {
    const client = SolShareClient.forFuturenet();
    expect(client.network).toBe('FUTURENET');
  });

  it('creates a standalone client via forStandalone()', () => {
    const client = SolShareClient.forStandalone();
    expect(client.network).toBe('STANDALONE');
  });

  it('accepts custom horizon and rpc URLs', () => {
    const client = new SolShareClient({
      network: 'STANDALONE',
      horizonUrl: 'http://custom:8000',
      sorobanRpcUrl: 'http://custom:8000/soroban/rpc',
    });
    expect(client.horizonUrl).toBe('http://custom:8000');
    expect(client.sorobanRpcUrl).toBe('http://custom:8000/soroban/rpc');
  });

  it('defaults contract addresses to empty strings', () => {
    const client = SolShareClient.forTestnet();
    expect(client.contracts.rwaToken).toBe('');
    expect(client.contracts.solarRegistry).toBe('');
    expect(client.contracts.yieldDistributor).toBe('');
    expect(client.contracts.bridgeWrapper).toBe('');
  });

  it('accepts a valid contract address', () => {
    const client = new SolShareClient({
      network: 'TESTNET',
      contracts: {
        rwaToken: VALID_CONTRACT,
      },
    });
    expect(client.contracts.rwaToken).toBe(VALID_CONTRACT);
    expect(client.contracts.solarRegistry).toBe('');
    expect(client.contracts.yieldDistributor).toBe('');
  });

  it('info() returns PROJECT_INFO', () => {
    const client = SolShareClient.forTestnet();
    expect(client.info()).toEqual(PROJECT_INFO);
  });

  it('auto-generates a simulation account when none provided', () => {
    const client = SolShareClient.forTestnet();
    expect(client.simulationAccount.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
  });

  it('setSimulationAccount() updates the client and all contracts', () => {
    const client = SolShareClient.forTestnet();
    const newAccount = SimulationAccount.random();
    client.setSimulationAccount(newAccount);
    expect(client.simulationAccount.publicKey).toBe(newAccount.publicKey);
  });

  it('fundSimulationAccount() throws on PUBLIC network', async () => {
    const client = SolShareClient.forPublic();
    await expect(client.fundSimulationAccount()).rejects.toThrow(
      'Friendbot funding is not available',
    );
  });

  it('has horizon, soroban, wallet, and stream sub-clients', () => {
    const client = SolShareClient.forTestnet();
    expect(client.horizon).toBeDefined();
    expect(client.soroban).toBeDefined();
    expect(client.wallet).toBeDefined();
    expect(client.stream).toBeDefined();
  });

  it('has contract accessor sub-clients', () => {
    const client = SolShareClient.forTestnet();
    expect(client.registry).toBeDefined();
    expect(client.rwaToken).toBeDefined();
    expect(client.yieldDistributor).toBeDefined();
    expect(client.bridge).toBeDefined();
  });

  it('uses correct passphrase for TESTNET', () => {
    const client = SolShareClient.forTestnet();
    expect(client.networkPassphrase).toContain('Test SDF Network');
  });

  it('uses correct passphrase for PUBLIC', () => {
    const client = SolShareClient.forPublic();
    expect(client.networkPassphrase).toContain('Public Global Stellar Network');
  });

  it('each client has a unique simulation account by default', () => {
    const a = SolShareClient.forTestnet();
    const b = SolShareClient.forTestnet();
    expect(a.simulationAccount.publicKey).not.toBe(b.simulationAccount.publicKey);
  });
});

import { describe, it, expect } from 'vitest';
import {
  STELLAR_NETWORKS,
  NETWORK_PASSPHRASES,
  NETWORK_ENDPOINTS,
  SUPPORTED_SOURCE_CHAINS,
  SOURCE_CHAIN_IDS,
  CONTRACT_EVENTS,
  PROJECT_INFO,
  resolveNetwork,
  resolveHorizonUrl,
  resolveSorobanRpcUrl,
} from './constants.js';

describe('STELLAR_NETWORKS', () => {
  it('defines the four networks', () => {
    expect(STELLAR_NETWORKS.PUBLIC).toBe('PUBLIC');
    expect(STELLAR_NETWORKS.TESTNET).toBe('TESTNET');
    expect(STELLAR_NETWORKS.FUTURENET).toBe('FUTURENET');
    expect(STELLAR_NETWORKS.STANDALONE).toBe('STANDALONE');
  });
});

describe('NETWORK_PASSPHRASES', () => {
  it('has correct passphrase for PUBLIC network', () => {
    expect(NETWORK_PASSPHRASES.PUBLIC).toContain('Public Global Stellar Network');
  });

  it('has correct passphrase for TESTNET', () => {
    expect(NETWORK_PASSPHRASES.TESTNET).toContain('Test SDF Network');
  });
});

describe('NETWORK_ENDPOINTS', () => {
  it('has horizon URL for testnet', () => {
    expect(NETWORK_ENDPOINTS.TESTNET.horizon).toContain('horizon-testnet.stellar.org');
  });

  it('has sorobanRpc URL for testnet', () => {
    expect(NETWORK_ENDPOINTS.TESTNET.sorobanRpc).toContain('soroban-testnet.stellar.org');
  });

  it('testnet has a friendbot', () => {
    expect(NETWORK_ENDPOINTS.TESTNET.friendbot).toContain('friendbot.stellar.org');
  });

  it('mainnet does not have a friendbot', () => {
    expect(NETWORK_ENDPOINTS.PUBLIC.friendbot).toBeUndefined();
  });
});

describe('resolveNetwork', () => {
  it('defaults to TESTNET when no argument given', () => {
    const orig = process.env.STELLAR_NETWORK;
    delete process.env.STELLAR_NETWORK;
    expect(resolveNetwork()).toBe('TESTNET');
    process.env.STELLAR_NETWORK = orig;
  });

  it('accepts explicit network string', () => {
    expect(resolveNetwork('PUBLIC')).toBe('PUBLIC');
    expect(resolveNetwork('TESTNET')).toBe('TESTNET');
    expect(resolveNetwork('FUTURENET')).toBe('FUTURENET');
    expect(resolveNetwork('STANDALONE')).toBe('STANDALONE');
  });

  it('is case-insensitive', () => {
    expect(resolveNetwork('testnet')).toBe('TESTNET');
    expect(resolveNetwork('public')).toBe('PUBLIC');
  });

  it('throws on unknown network', () => {
    expect(() => resolveNetwork('INVALID')).toThrow('Unknown Stellar network');
  });
});

describe('resolveHorizonUrl', () => {
  it('returns testnet horizon URL for TESTNET', () => {
    expect(resolveHorizonUrl('TESTNET')).toContain('horizon-testnet');
  });

  it('returns mainnet horizon URL for PUBLIC', () => {
    expect(resolveHorizonUrl('PUBLIC')).toContain('horizon.stellar.org');
  });
});

describe('resolveSorobanRpcUrl', () => {
  it('returns testnet soroban URL for TESTNET', () => {
    expect(resolveSorobanRpcUrl('TESTNET')).toContain('soroban-testnet');
  });
});

describe('SUPPORTED_SOURCE_CHAINS', () => {
  it('includes ethereum and solana', () => {
    expect(SUPPORTED_SOURCE_CHAINS).toContain('ethereum');
    expect(SUPPORTED_SOURCE_CHAINS).toContain('solana');
    expect(SUPPORTED_SOURCE_CHAINS).toContain('polygon');
  });
});

describe('SOURCE_CHAIN_IDS', () => {
  it('has correct chain ID for ethereum', () => {
    expect(SOURCE_CHAIN_IDS.ethereum).toBe(1);
  });

  it('has correct chain ID for polygon', () => {
    expect(SOURCE_CHAIN_IDS.polygon).toBe(137);
  });

  it('has custom ID range for solana (non-EVM)', () => {
    expect(SOURCE_CHAIN_IDS.solana).toBeGreaterThan(100_000);
  });
});

describe('CONTRACT_EVENTS', () => {
  it('defines core events', () => {
    expect(CONTRACT_EVENTS.Mint).toBe('mint');
    expect(CONTRACT_EVENTS.Burn).toBe('burn');
    expect(CONTRACT_EVENTS.Transfer).toBe('transfer');
    expect(CONTRACT_EVENTS.Claim).toBe('claim');
    expect(CONTRACT_EVENTS.Wrap).toBe('wrap');
    expect(CONTRACT_EVENTS.Unwrap).toBe('unwrap');
  });
});

describe('PROJECT_INFO', () => {
  it('has correct project name', () => {
    expect(PROJECT_INFO.name).toBe('SolShare Network');
  });

  it('has a version field', () => {
    expect(PROJECT_INFO.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('has a repo URL', () => {
    expect(PROJECT_INFO.repoUrl).toContain('github.com');
  });
});

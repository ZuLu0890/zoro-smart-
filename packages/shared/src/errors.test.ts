import { describe, it, expect } from 'vitest';
import {
  SolShareError,
  NetworkError,
  WalletError,
  TokenErrorCode,
  RegistryErrorCode,
  YieldErrorCode,
  BridgeErrorCode,
} from './errors.js';

describe('SolShareError', () => {
  it('creates an error with code and message', () => {
    const err = new SolShareError('Test error', 42);
    expect(err.message).toBe('Test error');
    expect(err.code).toBe(42);
    expect(err.name).toBe('SolShareError');
  });

  it('is an instance of Error', () => {
    const err = new SolShareError('Test', 1);
    expect(err instanceof Error).toBe(true);
  });

  it('optionally stores a contract field', () => {
    const err = new SolShareError('msg', 3, 'rwa-token');
    expect(err.contract).toBe('rwa-token');
  });

  it('creates from contract with fromContract()', () => {
    const err = SolShareError.fromContract(4, 'solar-registry');
    expect(err.code).toBe(4);
    expect(err.contract).toBe('solar-registry');
    expect(err.message).toContain('solar-registry');
  });

  it('fromContract accepts custom message', () => {
    const err = SolShareError.fromContract(5, 'bridge-wrapper', 'custom msg');
    expect(err.message).toBe('custom msg');
  });
});

describe('NetworkError', () => {
  it('creates a NetworkError with code -1', () => {
    const err = new NetworkError('Network timeout');
    expect(err.message).toBe('Network timeout');
    expect(err.code).toBe(-1);
    expect(err.name).toBe('NetworkError');
  });

  it('is a SolShareError', () => {
    const err = new NetworkError('timeout');
    expect(err instanceof SolShareError).toBe(true);
  });

  it('stores cause', () => {
    const cause = new Error('underlying');
    const err = new NetworkError('wrap', cause);
    expect(err.cause).toBe(cause);
  });
});

describe('WalletError', () => {
  it('creates a WalletError with code -2', () => {
    const err = new WalletError('Freighter not installed');
    expect(err.message).toBe('Freighter not installed');
    expect(err.code).toBe(-2);
    expect(err.name).toBe('WalletError');
  });

  it('is a SolShareError', () => {
    const err = new WalletError('test');
    expect(err instanceof SolShareError).toBe(true);
  });
});

describe('TokenErrorCode', () => {
  it('has expected numeric values', () => {
    expect(TokenErrorCode.NotInitialized).toBe(1);
    expect(TokenErrorCode.AlreadyInitialized).toBe(2);
    expect(TokenErrorCode.Unauthorized).toBe(3);
    expect(TokenErrorCode.InsufficientBalance).toBe(6);
    expect(TokenErrorCode.ZeroAmount).toBe(7);
  });
});

describe('RegistryErrorCode', () => {
  it('has expected numeric values', () => {
    expect(RegistryErrorCode.ArrayNotFound).toBe(4);
    expect(RegistryErrorCode.ArrayAlreadyExists).toBe(5);
    expect(RegistryErrorCode.InvalidStateTransition).toBe(6);
    expect(RegistryErrorCode.EmptyArrayId).toBe(7);
  });
});

describe('YieldErrorCode', () => {
  it('has expected numeric values', () => {
    expect(YieldErrorCode.UnknownShareToken).toBe(4);
    expect(YieldErrorCode.NothingToClaim).toBe(6);
    expect(YieldErrorCode.MathOverflow).toBe(7);
  });
});

describe('BridgeErrorCode', () => {
  it('has expected numeric values', () => {
    expect(BridgeErrorCode.AlreadyProcessed).toBe(4);
    expect(BridgeErrorCode.UnknownChain).toBe(5);
    expect(BridgeErrorCode.QuorumNotMet).toBe(9);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { SimulationAccount, fundSimulationAccount } from '../src/simulation-account.js';

describe('SimulationAccount', () => {
  it('creates a random account with public and secret keys', () => {
    const account = SimulationAccount.random();
    expect(account.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
    expect(account.secretKey).toMatch(/^S[A-Z2-7]{55}$/);
  });

  it('creates a SimulationAccount from given options', () => {
    const kp = SimulationAccount.random();
    const account = new SimulationAccount({
      publicKey: kp.publicKey,
      secretKey: kp.secretKey,
      sequenceNumber: '100',
    });
    expect(account.publicKey).toBe(kp.publicKey);
    expect(account.secretKey).toBe(kp.secretKey);
    expect(account.account.sequenceNumber()).toBe('100');
  });

  it('defaults sequenceNumber to 0', () => {
    const account = SimulationAccount.random();
    expect(account.account.sequenceNumber()).toBe('0');
  });

  it('can be constructed without a secret key', () => {
    const readOnly = new SimulationAccount({
      publicKey: SimulationAccount.random().publicKey,
    });
    expect(readOnly.secretKey).toBeUndefined();
  });

  it('set() replaces the inner account', () => {
    const a = SimulationAccount.random();
    const b = SimulationAccount.random();
    a.set({ publicKey: b.publicKey, secretKey: b.secretKey });
    expect(a.publicKey).toBe(b.publicKey);
    expect(a.secretKey).toBe(b.secretKey);
  });

  it('each random() call returns a unique keypair', () => {
    const a = SimulationAccount.random();
    const b = SimulationAccount.random();
    expect(a.publicKey).not.toBe(b.publicKey);
  });
});

describe('fundSimulationAccount', () => {
  it('throws when account has no secret key', async () => {
    const account = new SimulationAccount({
      publicKey: SimulationAccount.random().publicKey,
    });
    await expect(fundSimulationAccount(account, 'TESTNET')).rejects.toThrow(
      'Cannot fund a simulation account that was provided without a secret key',
    );
  });

  it('calls the friendbot endpoint for TESTNET', async () => {
    const account = SimulationAccount.random();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ funded: true }),
    });
    const result = await fundSimulationAccount(account, 'TESTNET', mockFetch as typeof fetch);
    expect(result).toEqual({ funded: true });
    const calledUrl = (mockFetch.mock.calls[0] as [string])[0];
    expect(calledUrl).toContain('friendbot.stellar.org');
    expect(calledUrl).toContain(encodeURIComponent(account.publicKey));
  });

  it('calls the FUTURENET friendbot endpoint', async () => {
    const account = SimulationAccount.random();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ funded: true }),
    });
    await fundSimulationAccount(account, 'FUTURENET', mockFetch as typeof fetch);
    const calledUrl = (mockFetch.mock.calls[0] as [string])[0];
    expect(calledUrl).toContain('futurenet');
  });

  it('throws when friendbot returns a non-ok response', async () => {
    const account = SimulationAccount.random();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
    });
    await expect(
      fundSimulationAccount(account, 'TESTNET', mockFetch as typeof fetch),
    ).rejects.toThrow('Friendbot funding failed (429)');
  });
});

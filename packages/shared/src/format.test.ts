import { describe, it, expect } from 'vitest';
import {
  formatAmount,
  formatXlm,
  formatUsdc,
  formatShares,
  shortenAddress,
  shortenTxHash,
  relativeTime,
  hexToBytes,
  bytesToHex,
  estimateAnnualKwh,
  estimateCo2OffsetKg,
} from './format.js';

describe('formatAmount', () => {
  it('formats an integer amount with 7 decimals', () => {
    expect(formatAmount(10_000_000n, 7)).toBe('1');
  });

  it('formats fractional amounts', () => {
    expect(formatAmount(15_000_000n, 7)).toBe('1.5');
  });

  it('handles zero', () => {
    expect(formatAmount(0n, 7)).toBe('0');
  });

  it('handles negative values', () => {
    expect(formatAmount(-10_000_000n, 7)).toBe('-1');
  });

  it('respects minDecimals option', () => {
    const result = formatAmount(10_000_000n, 7, { minDecimals: 2 });
    expect(result).toBe('1.00');
  });

  it('respects trimTrailingZeros=false', () => {
    const result = formatAmount(10_000_000n, 7, {
      trimTrailingZeros: false,
      minDecimals: 2,
    });
    expect(result).toBe('1.0000000');
  });

  it('accepts string input', () => {
    expect(formatAmount('20000000', 7)).toBe('2');
  });

  it('accepts number input', () => {
    expect(formatAmount(5_000_000, 7)).toBe('0.5');
  });
});

describe('formatXlm', () => {
  it('formats 1 XLM in stroops', () => {
    expect(formatXlm(10_000_000n)).toBe('1.00');
  });

  it('formats 0.5 XLM', () => {
    expect(formatXlm(5_000_000n)).toBe('0.50');
  });

  it('formats large amounts', () => {
    expect(formatXlm(1_000_000_000n)).toBe('100.00');
  });
});

describe('formatUsdc', () => {
  it('formats 1 USDC (6 decimals)', () => {
    expect(formatUsdc(1_000_000n)).toBe('1.00');
  });

  it('formats fractional USDC', () => {
    expect(formatUsdc(500_000n)).toBe('0.50');
  });
});

describe('formatShares', () => {
  it('formats share amounts with 7 decimals', () => {
    expect(formatShares(10_000_000n)).toBe('1.00');
  });

  it('formats zero shares', () => {
    expect(formatShares(0n)).toBe('0.00');
  });
});

describe('shortenAddress', () => {
  it('shortens a long Stellar address', () => {
    const addr = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTU';
    const result = shortenAddress(addr);
    expect(result).toMatch(/^GABC…RSTU$/);
  });

  it('returns empty string for empty input', () => {
    expect(shortenAddress('')).toBe('');
  });

  it('returns original if short enough', () => {
    expect(shortenAddress('GABCD', 4, 4)).toBe('GABCD');
  });

  it('supports custom head/tail lengths', () => {
    const addr = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTU';
    const result = shortenAddress(addr, 6, 6);
    expect(result.startsWith('GABCDE')).toBe(true);
    expect(result.endsWith('QRSTU')).toBe(true);
  });
});

describe('shortenTxHash', () => {
  it('shortens a tx hash', () => {
    const hash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    const result = shortenTxHash(hash);
    expect(result).toMatch(/^a1b2c3…/);
  });

  it('returns empty string for empty input', () => {
    expect(shortenTxHash('')).toBe('');
  });
});

describe('relativeTime', () => {
  it('returns seconds ago for recent timestamps', () => {
    const now = 1000;
    expect(relativeTime(990, now)).toBe('10s ago');
  });

  it('returns minutes ago', () => {
    const now = 3600;
    expect(relativeTime(3600 - 120, now)).toBe('2m ago');
  });

  it('returns hours ago', () => {
    const now = 7200;
    expect(relativeTime(3600, now)).toBe('1h ago');
  });

  it('returns days ago', () => {
    const now = 86400 * 3;
    expect(relativeTime(86400, now)).toBe('2d ago');
  });

  it('returns future time with "in" prefix', () => {
    const now = 1000;
    expect(relativeTime(1060, now)).toBe('in 1m');
  });
});

describe('hexToBytes / bytesToHex', () => {
  it('round-trips correctly', () => {
    const hex = 'deadbeef01020304';
    const bytes = hexToBytes(hex);
    expect(bytesToHex(bytes)).toBe(hex);
  });

  it('handles 0x prefix in hexToBytes', () => {
    const bytes = hexToBytes('0xff00');
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0x00);
  });

  it('adds 0x prefix when requested', () => {
    const bytes = new Uint8Array([0xde, 0xad]);
    expect(bytesToHex(bytes, true)).toBe('0xdead');
  });

  it('throws on odd-length hex', () => {
    expect(() => hexToBytes('abc')).toThrow('even length');
  });

  it('throws on invalid hex character', () => {
    expect(() => hexToBytes('zz')).toThrow('invalid hex');
  });
});

describe('estimateAnnualKwh', () => {
  it('estimates output for a 5 kW array', () => {
    // 5000 W / 1000 * 24 * 365 * 0.18 ≈ 7884
    expect(estimateAnnualKwh(5000)).toBe(7884);
  });

  it('uses custom capacity factor', () => {
    const kwh = estimateAnnualKwh(1000, 0.20);
    expect(kwh).toBe(1752);
  });
});

describe('estimateCo2OffsetKg', () => {
  it('calculates CO2 offset from kWh', () => {
    expect(estimateCo2OffsetKg(1000)).toBe(400);
  });

  it('uses custom kg/kWh factor', () => {
    expect(estimateCo2OffsetKg(1000, 0.5)).toBe(500);
  });
});

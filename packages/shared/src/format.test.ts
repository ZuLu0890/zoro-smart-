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
  it('formats a positive amount with the given decimals', () => {
    expect(formatAmount(123_456_789n, 6)).toBe('123.456789');
  });

  it('formats zero correctly', () => {
    expect(formatAmount(0n, 7)).toBe('0');
  });

  it('formats negative amounts with a leading minus', () => {
    expect(formatAmount(-1_000_000n, 6)).toBe('-1');
  });

  it('respects trimTrailingZeros=false', () => {
    expect(formatAmount(1_500_000n, 6, { trimTrailingZeros: false })).toBe('1.500000');
  });
});

describe('currency formatters', () => {
  it('formatXlm uses 7 decimals and at least 2 fraction digits', () => {
    expect(formatXlm(1_000_0000n)).toBe('1.00');
  });

  it('formatUsdc uses 6 decimals', () => {
    expect(formatUsdc(1_000_000n)).toBe('1.00');
  });

  it('formatShares uses 7 decimals (canonical)', () => {
    // 1_000_000_000n / 10^7 = 100 → "100.00"
    expect(formatShares(1_000_000_000n)).toBe('100.00');
  });
});

describe('shortenAddress', () => {
  it('returns the input unchanged when too short', () => {
    expect(shortenAddress('GABC')).toBe('GABC');
  });

  it('truncates long addresses with an ellipsis', () => {
    expect(shortenAddress('GABCDEFGHIJKLMNOP', 4, 4)).toBe('GABC…MNOP');
  });
});

describe('shortenTxHash', () => {
  it('truncates long hashes', () => {
    expect(shortenTxHash('a'.repeat(64), 6, 4)).toBe(`aaaaaa…${'a'.repeat(4)}`);
  });
});

describe('relativeTime', () => {
  const now = 1_700_000_000;
  it('returns "Ns ago" for sub-minute deltas', () => {
    expect(relativeTime(now - 30, now)).toBe('30s ago');
  });
  it('returns "Nm ago" for sub-hour deltas', () => {
    expect(relativeTime(now - 300, now)).toBe('5m ago');
  });
  it('returns "Nh ago" for sub-day deltas', () => {
    expect(relativeTime(now - 7200, now)).toBe('2h ago');
  });
});

describe('hex / bytes round-trip', () => {
  it('hexToBytes decodes a 0x-prefixed hex string', () => {
    const bytes = hexToBytes('0xdeadbeef');
    expect(Array.from(bytes)).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });

  it('bytesToHex encodes back without prefix by default', () => {
    expect(bytesToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe('deadbeef');
  });

  it('bytesToHex adds a 0x prefix when requested', () => {
    expect(bytesToHex(new Uint8Array([0x01, 0x02]), true)).toBe('0x0102');
  });

  it('rejects odd-length hex', () => {
    expect(() => hexToBytes('abc')).toThrow(/even length/);
  });
});

describe('energy + CO₂ estimators', () => {
  it('estimateAnnualKwh uses 0.18 capacity factor by default', () => {
    // Math.round((1000/1000) * 24 * 365 * 0.18) = Math.round(1576.8) = 1577
    expect(estimateAnnualKwh(1000)).toBe(1577);
  });

  it('estimateCo2OffsetKg uses 0.4 kg/kWh by default', () => {
    expect(estimateCo2OffsetKg(1000)).toBe(400);
  });
});

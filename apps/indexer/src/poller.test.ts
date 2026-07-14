import { describe, it, expect } from 'vitest';
import { classifyEvent } from '../src/poller.js';
import type { SorobanEvent } from '@solshare/sdk';
import { CONTRACT_EVENTS } from '@solshare/shared';

function makeEvent(topic: string[]): SorobanEvent {
  return {
    type: 'contract',
    ledger: 100,
    ledgerClosedAt: new Date().toISOString(),
    contractId: 'CABCDEF',
    id: 'event-id',
    pagingToken: '0000',
    topic,
    value: {},
  } as unknown as SorobanEvent;
}

describe('classifyEvent', () => {
  it('returns Init for an event with an empty topic array', () => {
    const event = makeEvent([]);
    expect(classifyEvent(event)).toBe('Init');
  });

  it('classifies a mint event', () => {
    const event = makeEvent([CONTRACT_EVENTS.Mint]);
    expect(classifyEvent(event)).toBe('Mint');
  });

  it('classifies a burn event', () => {
    const event = makeEvent([CONTRACT_EVENTS.Burn]);
    expect(classifyEvent(event)).toBe('Burn');
  });

  it('classifies a transfer event', () => {
    const event = makeEvent([CONTRACT_EVENTS.Transfer]);
    expect(classifyEvent(event)).toBe('Transfer');
  });

  it('classifies a claim event', () => {
    const event = makeEvent([CONTRACT_EVENTS.Claim]);
    expect(classifyEvent(event)).toBe('Claim');
  });

  it('classifies a wrap event', () => {
    const event = makeEvent([CONTRACT_EVENTS.Wrap]);
    expect(classifyEvent(event)).toBe('Wrap');
  });

  it('classifies an unwrap event', () => {
    const event = makeEvent([CONTRACT_EVENTS.Unwrap]);
    expect(classifyEvent(event)).toBe('Unwrap');
  });

  it('classifies a register event', () => {
    const event = makeEvent([CONTRACT_EVENTS.Register]);
    expect(classifyEvent(event)).toBe('Register');
  });

  it('classifies a fund event', () => {
    const event = makeEvent([CONTRACT_EVENTS.Fund]);
    expect(classifyEvent(event)).toBe('Fund');
  });

  it('falls back to Init for an unknown topic', () => {
    const event = makeEvent(['unknown_topic_xyz']);
    expect(classifyEvent(event)).toBe('Init');
  });

  it('uses only the first topic element for classification', () => {
    const event = makeEvent([CONTRACT_EVENTS.Mint, CONTRACT_EVENTS.Burn]);
    expect(classifyEvent(event)).toBe('Mint');
  });

  // -----------------------------------------------------------------------
  // ScVal JSON-object topic format (canonical form from live Soroban RPC)
  // -----------------------------------------------------------------------

  it('classifies a mint event from ScVal symbol object topic', () => {
    const event = makeEvent([JSON.stringify({ type: 'symbol', value: 'mint' })]);
    expect(classifyEvent(event)).toBe('Mint');
  });

  it('classifies a claim event from ScVal symbol object topic', () => {
    const event = makeEvent([JSON.stringify({ type: 'symbol', value: 'claim' })]);
    expect(classifyEvent(event)).toBe('Claim');
  });

  it('classifies a fund event from ScVal symbol object topic', () => {
    const event = makeEvent([JSON.stringify({ type: 'symbol', value: 'fund' })]);
    expect(classifyEvent(event)).toBe('Fund');
  });

  it('classifies a transfer event from ScVal symbol object topic', () => {
    const event = makeEvent([JSON.stringify({ type: 'symbol', value: 'transfer' })]);
    expect(classifyEvent(event)).toBe('Transfer');
  });

  it('falls back to Init for a ScVal object with unknown value', () => {
    const event = makeEvent([JSON.stringify({ type: 'symbol', value: 'unknown_xyz' })]);
    expect(classifyEvent(event)).toBe('Init');
  });

  it('falls back to Init for a ScVal object missing the value field', () => {
    const event = makeEvent([JSON.stringify({ type: 'symbol' })]);
    expect(classifyEvent(event)).toBe('Init');
  });

  it('handles malformed JSON topic gracefully by falling back to Init', () => {
    const event = makeEvent(['{not valid json']);
    expect(classifyEvent(event)).toBe('Init');
  });
});

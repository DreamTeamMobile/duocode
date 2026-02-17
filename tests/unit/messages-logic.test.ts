/**
 * Messages Logic Service Unit Tests
 *
 * Tests for timestamp formatting, deduplication, acknowledgment tracking,
 * and relay routing from src/services/messages-logic.js.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatTimestamp,
  formatEpochToLocalTime,
  MessageDeduplicator,
  AcknowledgmentTracker,
  getRelayTargets,
  buildRelayPayload,
} from '../../src/services/messages-logic.js';

// ── Timestamp Formatting ────────────────────────────────────────────────────

describe('formatTimestamp', () => {
  it('should format current time as HH:MM:SS when no arg', () => {
    const ts = formatTimestamp();
    expect(ts).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('should format a specific epoch', () => {
    // 2024-01-15 10:30:45 UTC
    const epoch = new Date(2024, 0, 15, 10, 30, 45).getTime();
    const ts = formatTimestamp(epoch);
    expect(ts).toBe('10:30:45');
  });

  it('should zero-pad single digit values', () => {
    const epoch = new Date(2024, 0, 1, 1, 2, 3).getTime();
    const ts = formatTimestamp(epoch);
    expect(ts).toBe('01:02:03');
  });
});

describe('formatEpochToLocalTime', () => {
  it('should format epoch number', () => {
    const epoch = new Date(2024, 5, 1, 14, 30, 0).getTime();
    const ts = formatEpochToLocalTime(epoch);
    expect(ts).toBe('14:30:00');
  });

  it('should return string timestamp as-is (legacy)', () => {
    expect(formatEpochToLocalTime('12:34:56')).toBe('12:34:56');
  });

  it('should return current time for null', () => {
    const ts = formatEpochToLocalTime(null);
    expect(ts).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('should return current time for undefined', () => {
    const ts = formatEpochToLocalTime(undefined as unknown as number | string | null);
    expect(ts).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

// ── MessageDeduplicator ─────────────────────────────────────────────────────

describe('MessageDeduplicator', () => {
  let dedup: MessageDeduplicator;

  beforeEach(() => {
    dedup = new MessageDeduplicator(10, 5);
  });

  it('should not have seen unknown IDs', () => {
    expect(dedup.hasSeen('abc')).toBe(false);
  });

  it('should mark and detect seen IDs', () => {
    dedup.markSeen('msg-1');
    expect(dedup.hasSeen('msg-1')).toBe(true);
    expect(dedup.hasSeen('msg-2')).toBe(false);
  });

  it('should track size', () => {
    dedup.markSeen('a');
    dedup.markSeen('b');
    expect(dedup.size).toBe(2);
  });

  it('should trim when exceeding maxSize', () => {
    // maxSize=10, trimTo=5
    for (let i = 0; i < 11; i++) {
      dedup.markSeen(`msg-${i}`);
    }
    // After adding 11th, should trim to last 5
    expect(dedup.size).toBe(5);
    // Oldest should be gone
    expect(dedup.hasSeen('msg-0')).toBe(false);
    // Most recent should still be there
    expect(dedup.hasSeen('msg-10')).toBe(true);
  });

  it('should clear all entries', () => {
    dedup.markSeen('x');
    dedup.clear();
    expect(dedup.size).toBe(0);
    expect(dedup.hasSeen('x')).toBe(false);
  });

  it('should handle default sizes (1000/500)', () => {
    const big = new MessageDeduplicator();
    for (let i = 0; i < 1001; i++) {
      big.markSeen(`id-${i}`);
    }
    expect(big.size).toBe(500);
  });
});

// ── AcknowledgmentTracker ───────────────────────────────────────────────────

describe('AcknowledgmentTracker', () => {
  let tracker: AcknowledgmentTracker;

  beforeEach(() => {
    tracker = new AcknowledgmentTracker();
  });

  it('should add and check pending messages', () => {
    tracker.add('msg-1', { text: 'hello' });
    expect(tracker.has('msg-1')).toBe(true);
    expect(tracker.size).toBe(1);
  });

  it('should acknowledge and remove pending message', () => {
    tracker.add('msg-1', { text: 'hello' });
    const result = tracker.acknowledge('msg-1');
    expect(result).toBe(true);
    expect(tracker.has('msg-1')).toBe(false);
    expect(tracker.size).toBe(0);
  });

  it('should return false when acknowledging unknown message', () => {
    expect(tracker.acknowledge('unknown')).toBe(false);
  });

  it('should list unacknowledged messages', () => {
    tracker.add('a', { id: 'a' });
    tracker.add('b', { id: 'b' });
    tracker.add('c', { id: 'c' });
    tracker.acknowledge('b');

    const unacked = tracker.getUnacknowledged();
    expect(unacked).toHaveLength(2);
    expect(unacked.map((m: Record<string, unknown>) => m.id).sort()).toEqual(['a', 'c']);
  });

  it('should clear all pending', () => {
    tracker.add('x', {});
    tracker.clear();
    expect(tracker.size).toBe(0);
  });
});

// ── Relay Routing ───────────────────────────────────────────────────────────

describe('getRelayTargets', () => {
  it('should return open peers excluding sender', () => {
    const channels = new Map<string, { readyState: string } | null>([
      ['peer-1', { readyState: 'open' }],
      ['peer-2', { readyState: 'open' }],
      ['peer-3', { readyState: 'closed' }],
    ]);
    const targets = getRelayTargets(channels, 'peer-1');
    expect(targets).toEqual(['peer-2']);
  });

  it('should return all open peers when no exclude', () => {
    const channels = new Map<string, { readyState: string } | null>([
      ['peer-1', { readyState: 'open' }],
      ['peer-2', { readyState: 'open' }],
    ]);
    const targets = getRelayTargets(channels, null);
    expect(targets).toEqual(['peer-1', 'peer-2']);
  });

  it('should return empty array when all closed', () => {
    const channels = new Map<string, { readyState: string } | null>([
      ['peer-1', { readyState: 'closed' }],
    ]);
    expect(getRelayTargets(channels, null)).toEqual([]);
  });

  it('should handle empty channel map', () => {
    expect(getRelayTargets(new Map(), null)).toEqual([]);
  });

  it('should handle null channels gracefully', () => {
    const channels = new Map<string, { readyState: string } | null>([
      ['peer-1', null],
      ['peer-2', { readyState: 'open' }],
    ]);
    const targets = getRelayTargets(channels, null);
    expect(targets).toEqual(['peer-2']);
  });
});

describe('buildRelayPayload', () => {
  it('should build a JSON string with type, content, timestamp', () => {
    const payload = buildRelayPayload('chat', { text: 'hi' });
    const parsed: { type: string; content: { text: string }; timestamp: number } = JSON.parse(payload);
    expect(parsed.type).toBe('chat');
    expect(parsed.content).toEqual({ text: 'hi' });
    expect(typeof parsed.timestamp).toBe('number');
  });
});

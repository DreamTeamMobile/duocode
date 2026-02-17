/**
 * Messages Logic Service
 *
 * Pure, framework-agnostic message handling helpers extracted from app.js.
 * Covers deduplication, acknowledgment tracking, timestamp formatting,
 * and relay routing logic.
 */

// ── Timestamp Formatting ────────────────────────────────────────────────────

export function formatTimestamp(epochTime: number | null = null): string {
  const date = epochTime ? new Date(epochTime) : new Date();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function formatEpochToLocalTime(epoch: number | string | null): string {
  if (!epoch) {
    return formatTimestamp();
  }
  if (typeof epoch === 'string') {
    return epoch;
  }
  return formatTimestamp(epoch);
}

// ── Message Deduplication ───────────────────────────────────────────────────

/**
 * Bounded deduplication set that trims itself to prevent unbounded memory growth.
 * When the set exceeds `maxSize`, it keeps only the most recent `trimTo` entries.
 */
export class MessageDeduplicator {
  private maxSize: number;
  private trimTo: number;
  private _seen: Set<string>;

  constructor(maxSize: number = 1000, trimTo: number = 500) {
    this.maxSize = maxSize;
    this.trimTo = trimTo;
    this._seen = new Set();
  }

  hasSeen(id: string): boolean {
    return this._seen.has(id);
  }

  markSeen(id: string): void {
    this._seen.add(id);
    if (this._seen.size > this.maxSize) {
      const arr = Array.from(this._seen);
      this._seen = new Set(arr.slice(-this.trimTo));
    }
  }

  get size(): number {
    return this._seen.size;
  }

  clear(): void {
    this._seen.clear();
  }
}

// ── Message Acknowledgment Tracker ──────────────────────────────────────────

export interface MessageData {
  [key: string]: unknown;
}

/**
 * Tracks pending message acknowledgments and provides retry logic.
 */
export class AcknowledgmentTracker {
  private _pending: Map<string, MessageData>;

  constructor() {
    this._pending = new Map();
  }

  add(messageId: string, messageData: MessageData): void {
    this._pending.set(messageId, messageData);
  }

  acknowledge(messageId: string): boolean {
    return this._pending.delete(messageId);
  }

  getUnacknowledged(): MessageData[] {
    return Array.from(this._pending.values());
  }

  get size(): number {
    return this._pending.size;
  }

  has(messageId: string): boolean {
    return this._pending.has(messageId);
  }

  clear(): void {
    this._pending.clear();
  }
}

// ── Relay Routing ───────────────────────────────────────────────────────────

export interface DataChannelLike {
  readyState: string;
}

export function getRelayTargets(
  channels: Map<string, DataChannelLike | null>,
  excludePeerId: string | null
): string[] {
  const targets: string[] = [];
  channels.forEach((channel, peerId) => {
    if (peerId !== excludePeerId && channel?.readyState === 'open') {
      targets.push(peerId);
    }
  });
  return targets;
}

export function buildRelayPayload(type: string, content: unknown): string {
  return JSON.stringify({
    type,
    content,
    timestamp: Date.now(),
  });
}

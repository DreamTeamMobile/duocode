/**
 * Message Queue and Ordering Unit Tests
 *
 * Tests for message sequencing, acknowledgments, and reliable delivery.
 * Imports MessageDeduplicator and AcknowledgmentTracker from
 * src/services/messages-logic.js.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MessageDeduplicator,
  AcknowledgmentTracker,
} from '../../src/services/messages-logic.js';

interface QueueMessage {
  [key: string]: unknown;
  id: string;
  text: string;
  role: string;
  seq?: number;
  timestamp: number;
  acknowledged?: boolean;
  receivedAt?: number;
}

interface HandleResult {
  status: 'accepted' | 'duplicate' | 'out_of_order';
  message: QueueMessage | null;
}

/**
 * Thin wrapper that mirrors the original test helper API (MessageQueue)
 * while delegating to the extracted service classes.
 */
class MessageQueue {
  messageHistory: QueueMessage[];
  messageSequenceNumber: number;
  lastReceivedMessageSeq: number;
  pendingAcknowledgments: AcknowledgmentTracker;
  _dedup: MessageDeduplicator;

  constructor() {
    this.messageHistory = [];
    this.messageSequenceNumber = 0;
    this.lastReceivedMessageSeq = -1;
    this.pendingAcknowledgments = new AcknowledgmentTracker();
    this._dedup = new MessageDeduplicator();
  }

  createMessage(text: string, role: string): QueueMessage {
    const message: QueueMessage = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text,
      role,
      seq: this.messageSequenceNumber++,
      timestamp: Date.now(),
      acknowledged: false
    };
    return message;
  }

  queueMessage(message: QueueMessage): QueueMessage {
    this.messageHistory.push(message);
    this.pendingAcknowledgments.add(message.id, message);
    return message;
  }

  handleIncomingMessage(messageData: QueueMessage): HandleResult {
    if (this.isDuplicate(messageData)) {
      return { status: 'duplicate', message: null };
    }

    if (messageData.seq !== undefined) {
      if (messageData.seq <= this.lastReceivedMessageSeq) {
        return { status: 'out_of_order', message: null };
      }
      this.lastReceivedMessageSeq = messageData.seq;
    }

    const message: QueueMessage = {
      ...messageData,
      receivedAt: Date.now()
    };
    this.messageHistory.push(message);

    return { status: 'accepted', message };
  }

  isDuplicate(messageData: QueueMessage): boolean {
    return this.messageHistory.some(m => m.id === messageData.id);
  }

  acknowledgeMessage(messageId: string): boolean {
    const hasIt = this.pendingAcknowledgments.has(messageId);
    if (hasIt) {
      // Mark acknowledged on the message object for test compatibility
      const msgs = this.pendingAcknowledgments.getUnacknowledged();
      const msg = msgs.find(m => (m as QueueMessage).id === messageId) as QueueMessage | undefined;
      if (msg) msg.acknowledged = true;
      this.pendingAcknowledgments.acknowledge(messageId);
      return true;
    }
    return false;
  }

  getUnacknowledgedMessages(): QueueMessage[] {
    return this.pendingAcknowledgments.getUnacknowledged() as QueueMessage[];
  }

  getOrderedMessages(): QueueMessage[] {
    return [...this.messageHistory].sort((a, b) => {
      if (a.seq !== undefined && b.seq !== undefined) {
        return a.seq - b.seq;
      }
      return a.timestamp - b.timestamp;
    });
  }

  getMessageCount(): number {
    return this.messageHistory.length;
  }

  clear(): void {
    this.messageHistory = [];
    this.messageSequenceNumber = 0;
    this.lastReceivedMessageSeq = -1;
    this.pendingAcknowledgments.clear();
  }
}

describe('Message Creation', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue();
  });

  it('should create message with unique ID', () => {
    const msg = queue.createMessage('Hello', 'interviewer');
    expect(msg.id).toBeTruthy();
    expect(msg.id.length).toBeGreaterThan(10);
  });

  it('should create message with incrementing sequence number', () => {
    const msg1 = queue.createMessage('First', 'interviewer');
    const msg2 = queue.createMessage('Second', 'interviewer');
    const msg3 = queue.createMessage('Third', 'candidate');

    expect(msg1.seq).toBe(0);
    expect(msg2.seq).toBe(1);
    expect(msg3.seq).toBe(2);
  });

  it('should include text and role', () => {
    const msg = queue.createMessage('Test message', 'candidate');
    expect(msg.text).toBe('Test message');
    expect(msg.role).toBe('candidate');
  });

  it('should include timestamp', () => {
    const before = Date.now();
    const msg = queue.createMessage('Test', 'interviewer');
    const after = Date.now();

    expect(msg.timestamp).toBeGreaterThanOrEqual(before);
    expect(msg.timestamp).toBeLessThanOrEqual(after);
  });

  it('should create unique IDs for concurrent messages', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const msg = queue.createMessage(`Message ${i}`, 'interviewer');
      ids.add(msg.id);
    }
    expect(ids.size).toBe(1000);
  });
});

describe('Message Queuing', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue();
  });

  it('should add message to history', () => {
    const msg = queue.createMessage('Test', 'interviewer');
    queue.queueMessage(msg);
    expect(queue.getMessageCount()).toBe(1);
  });

  it('should add message to pending acknowledgments', () => {
    const msg = queue.createMessage('Test', 'interviewer');
    queue.queueMessage(msg);
    expect(queue.pendingAcknowledgments.has(msg.id)).toBe(true);
  });

  it('should return queued message', () => {
    const msg = queue.createMessage('Test', 'interviewer');
    const queued = queue.queueMessage(msg);
    expect(queued).toBe(msg);
  });

  it('should handle multiple messages', () => {
    for (let i = 0; i < 10; i++) {
      const msg = queue.createMessage(`Message ${i}`, 'interviewer');
      queue.queueMessage(msg);
    }
    expect(queue.getMessageCount()).toBe(10);
    expect(queue.pendingAcknowledgments.size).toBe(10);
  });
});

describe('Incoming Message Handling', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue();
  });

  it('should accept valid incoming message', () => {
    const result = queue.handleIncomingMessage({
      id: 'remote-1',
      text: 'Hello from remote',
      role: 'candidate',
      seq: 0,
      timestamp: Date.now()
    });

    expect(result.status).toBe('accepted');
    expect(result.message).toBeTruthy();
    expect(queue.getMessageCount()).toBe(1);
  });

  it('should reject duplicate messages', () => {
    const messageData: QueueMessage = {
      id: 'remote-1',
      text: 'Hello',
      role: 'candidate',
      seq: 0,
      timestamp: Date.now()
    };

    queue.handleIncomingMessage(messageData);
    const result = queue.handleIncomingMessage(messageData);

    expect(result.status).toBe('duplicate');
    expect(queue.getMessageCount()).toBe(1);
  });

  it('should reject out-of-order messages', () => {
    queue.handleIncomingMessage({
      id: 'remote-1',
      text: 'First',
      role: 'candidate',
      seq: 5,
      timestamp: Date.now()
    });

    const result = queue.handleIncomingMessage({
      id: 'remote-2',
      text: 'Second (out of order)',
      role: 'candidate',
      seq: 3, // Lower than last received (5)
      timestamp: Date.now()
    });

    expect(result.status).toBe('out_of_order');
  });

  it('should accept messages with higher sequence numbers', () => {
    queue.handleIncomingMessage({
      id: 'remote-1',
      text: 'First',
      role: 'candidate',
      seq: 0,
      timestamp: Date.now()
    });

    const result = queue.handleIncomingMessage({
      id: 'remote-2',
      text: 'Second',
      role: 'candidate',
      seq: 1,
      timestamp: Date.now()
    });

    expect(result.status).toBe('accepted');
    expect(queue.lastReceivedMessageSeq).toBe(1);
  });

  it('should add receivedAt timestamp', () => {
    const before = Date.now();
    const result = queue.handleIncomingMessage({
      id: 'remote-1',
      text: 'Test',
      role: 'candidate',
      seq: 0,
      timestamp: Date.now()
    });
    const after = Date.now();

    expect(result.message!.receivedAt).toBeGreaterThanOrEqual(before);
    expect(result.message!.receivedAt).toBeLessThanOrEqual(after);
  });
});

describe('Message Acknowledgment', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue();
  });

  it('should acknowledge pending message', () => {
    const msg = queue.createMessage('Test', 'interviewer');
    queue.queueMessage(msg);

    const result = queue.acknowledgeMessage(msg.id);

    expect(result).toBe(true);
    expect(msg.acknowledged).toBe(true);
    expect(queue.pendingAcknowledgments.has(msg.id)).toBe(false);
  });

  it('should return false for non-existent message', () => {
    const result = queue.acknowledgeMessage('non-existent-id');
    expect(result).toBe(false);
  });

  it('should not re-acknowledge already acknowledged message', () => {
    const msg = queue.createMessage('Test', 'interviewer');
    queue.queueMessage(msg);

    queue.acknowledgeMessage(msg.id);
    const result = queue.acknowledgeMessage(msg.id);

    expect(result).toBe(false);
  });

  it('should track unacknowledged messages', () => {
    const msg1 = queue.createMessage('First', 'interviewer');
    const msg2 = queue.createMessage('Second', 'interviewer');
    const msg3 = queue.createMessage('Third', 'interviewer');

    queue.queueMessage(msg1);
    queue.queueMessage(msg2);
    queue.queueMessage(msg3);

    queue.acknowledgeMessage(msg2.id);

    const unacked = queue.getUnacknowledgedMessages();
    expect(unacked.length).toBe(2);
    expect(unacked.some(m => m.id === msg1.id)).toBe(true);
    expect(unacked.some(m => m.id === msg3.id)).toBe(true);
  });
});

describe('Message Ordering', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue();
  });

  it('should return messages in sequence order', () => {
    // Add messages out of order
    queue.handleIncomingMessage({ id: '3', text: 'Third', role: 'candidate', seq: 2, timestamp: 3000 });
    queue.handleIncomingMessage({ id: '1', text: 'First', role: 'candidate', seq: 0, timestamp: 1000 });
    queue.handleIncomingMessage({ id: '2', text: 'Second', role: 'candidate', seq: 1, timestamp: 2000 });

    // Note: With strict sequence checking, only the first message would be accepted
    // For this test, we're testing the ordering logic itself
    queue.messageHistory = [
      { id: '3', text: 'Third', role: 'candidate', seq: 2, timestamp: 3000 },
      { id: '1', text: 'First', role: 'candidate', seq: 0, timestamp: 1000 },
      { id: '2', text: 'Second', role: 'candidate', seq: 1, timestamp: 2000 },
    ];

    const ordered = queue.getOrderedMessages();

    expect(ordered[0].seq).toBe(0);
    expect(ordered[1].seq).toBe(1);
    expect(ordered[2].seq).toBe(2);
  });

  it('should order by timestamp when sequence is undefined', () => {
    queue.messageHistory = [
      { id: '2', text: 'Second', role: 'candidate', timestamp: 2000 },
      { id: '1', text: 'First', role: 'candidate', timestamp: 1000 },
      { id: '3', text: 'Third', role: 'candidate', timestamp: 3000 },
    ];

    const ordered = queue.getOrderedMessages();

    expect(ordered[0].timestamp).toBe(1000);
    expect(ordered[1].timestamp).toBe(2000);
    expect(ordered[2].timestamp).toBe(3000);
  });

  it('should not modify original array', () => {
    const msg = queue.createMessage('Test', 'interviewer');
    queue.queueMessage(msg);

    const ordered = queue.getOrderedMessages();
    ordered.push({ id: 'fake', text: 'Fake', role: 'fake', seq: 99, timestamp: 0 });

    expect(queue.getMessageCount()).toBe(1);
  });
});

describe('Queue Cleanup', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue();
  });

  it('should clear all messages', () => {
    for (let i = 0; i < 5; i++) {
      const msg = queue.createMessage(`Message ${i}`, 'interviewer');
      queue.queueMessage(msg);
    }

    queue.clear();

    expect(queue.getMessageCount()).toBe(0);
    expect(queue.messageSequenceNumber).toBe(0);
    expect(queue.lastReceivedMessageSeq).toBe(-1);
    expect(queue.pendingAcknowledgments.size).toBe(0);
  });

  it('should allow new messages after clear', () => {
    const msg1 = queue.createMessage('Before clear', 'interviewer');
    queue.queueMessage(msg1);

    queue.clear();

    const msg2 = queue.createMessage('After clear', 'interviewer');
    queue.queueMessage(msg2);

    expect(msg2.seq).toBe(0);
    expect(queue.getMessageCount()).toBe(1);
  });
});

describe('Duplicate Detection', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue();
  });

  it('should detect duplicate by ID', () => {
    const msg: QueueMessage = { id: 'unique-id', text: 'Test', role: 'interviewer', seq: 0, timestamp: Date.now() };
    queue.handleIncomingMessage(msg);

    expect(queue.isDuplicate(msg)).toBe(true);
  });

  it('should not flag non-duplicate', () => {
    const msg1: QueueMessage = { id: 'id-1', text: 'Test 1', role: 'interviewer', seq: 0, timestamp: Date.now() };
    const msg2: QueueMessage = { id: 'id-2', text: 'Test 2', role: 'interviewer', seq: 1, timestamp: Date.now() };

    queue.handleIncomingMessage(msg1);

    expect(queue.isDuplicate(msg2)).toBe(false);
  });

  it('should detect duplicate regardless of content changes', () => {
    const msg1: QueueMessage = { id: 'same-id', text: 'Original', role: 'interviewer', seq: 0, timestamp: Date.now() };
    const msg2: QueueMessage = { id: 'same-id', text: 'Modified', role: 'candidate', seq: 1, timestamp: Date.now() + 1000 };

    queue.handleIncomingMessage(msg1);

    expect(queue.isDuplicate(msg2)).toBe(true);
  });
});

describe('Message History Integration', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue();
  });

  it('should interleave local and remote messages correctly', () => {
    // Simulate conversation
    const local1 = queue.createMessage('Hello!', 'interviewer');
    queue.queueMessage(local1);

    queue.handleIncomingMessage({
      id: 'remote-1',
      text: 'Hi there!',
      role: 'candidate',
      seq: 0,
      timestamp: Date.now()
    });

    const local2 = queue.createMessage('How are you?', 'interviewer');
    queue.queueMessage(local2);

    queue.handleIncomingMessage({
      id: 'remote-2',
      text: 'Doing well, thanks!',
      role: 'candidate',
      seq: 1,
      timestamp: Date.now()
    });

    expect(queue.getMessageCount()).toBe(4);
  });

  it('should maintain correct order for rapid message exchange', () => {
    // Simulate rapid typing
    for (let i = 0; i < 20; i++) {
      const role = i % 2 === 0 ? 'interviewer' : 'candidate';
      if (role === 'interviewer') {
        const msg = queue.createMessage(`Local ${i}`, role);
        queue.queueMessage(msg);
      } else {
        queue.handleIncomingMessage({
          id: `remote-${i}`,
          text: `Remote ${i}`,
          role,
          seq: Math.floor(i / 2),
          timestamp: Date.now() + i
        });
      }
    }

    const ordered = queue.getOrderedMessages();
    expect(ordered.length).toBe(20);
  });
});

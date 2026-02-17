import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMessageSync } from '../../../src/hooks/useMessageSync.js';
import { useMessagesStore } from '../../../src/stores/messagesStore.js';
import { useSessionStore } from '../../../src/stores/sessionStore.js';
import type { DataChannelMessage } from '../../../src/services/connection-manager.js';

describe('useMessageSync', () => {
  let sendMessage: ReturnType<typeof vi.fn<(data: DataChannelMessage) => boolean>>;

  beforeEach(() => {
    sendMessage = vi.fn(() => true);
    useMessagesStore.getState().reset();
    useSessionStore.getState().reset();
    useSessionStore.getState().setPeerName('TestUser');
  });

  it('returns handleMessage and sendChatMessage', () => {
    const { result } = renderHook(() => useMessageSync({ sendMessage }));
    expect(typeof result.current.handleMessage).toBe('function');
    expect(typeof result.current.sendChatMessage).toBe('function');
  });

  describe('sendChatMessage', () => {
    it('adds message to store and sends over data channel', () => {
      const { result } = renderHook(() => useMessageSync({ sendMessage }));

      let messageId: string;
      act(() => {
        messageId = result.current.sendChatMessage('Hello!');
      });

      // Message should be in the store
      const messages = useMessagesStore.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello!');
      expect(messages[0].sender).toBe('TestUser');
      expect(messages[0].isSelf).toBe(true);
      expect(messages[0].id).toBe(messageId!);

      // Should have sent over data channel
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message',
          text: 'Hello!',
          sender: 'TestUser',
          id: messageId!,
        })
      );
    });

    it('generates unique message IDs', () => {
      const { result } = renderHook(() => useMessageSync({ sendMessage }));

      let id1: string, id2: string;
      act(() => {
        id1 = result.current.sendChatMessage('msg1');
        id2 = result.current.sendChatMessage('msg2');
      });

      expect(id1!).toBeDefined();
      expect(id2!).toBeDefined();
      expect(id1!).not.toBe(id2!);
    });
  });

  describe('incoming message handling', () => {
    it('adds remote message to store', () => {
      const { result } = renderHook(() => useMessageSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({
          type: 'message',
          id: 'remote-msg-1',
          text: 'Hi from remote!',
          sender: 'Alice',
          timestamp: 1700000000000,
        });
      });

      const messages = useMessagesStore.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hi from remote!');
      expect(messages[0].sender).toBe('Alice');
      expect(messages[0].isSelf).toBe(false);
    });

    it('sends acknowledgment for received messages', () => {
      const { result } = renderHook(() => useMessageSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({
          type: 'message',
          id: 'remote-msg-2',
          text: 'Need ack',
          sender: 'Bob',
          timestamp: Date.now(),
        });
      });

      expect(sendMessage).toHaveBeenCalledWith({
        type: 'message-ack',
        messageId: 'remote-msg-2',
      });
    });

    it('deduplicates messages with the same ID', () => {
      const { result } = renderHook(() => useMessageSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({
          type: 'message',
          id: 'dup-id',
          text: 'First',
          sender: 'Alice',
          timestamp: Date.now(),
        });
      });

      act(() => {
        result.current.handleMessage({
          type: 'message',
          id: 'dup-id',
          text: 'Duplicate!',
          sender: 'Alice',
          timestamp: Date.now(),
        });
      });

      expect(useMessagesStore.getState().messages).toHaveLength(1);
      expect(useMessagesStore.getState().messages[0].content).toBe('First');
    });

    it('ignores messages without an ID', () => {
      const { result } = renderHook(() => useMessageSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({
          type: 'message',
          id: '',
          text: 'No id',
          sender: 'Unknown',
          timestamp: Date.now(),
        });
      });

      expect(useMessagesStore.getState().messages).toHaveLength(0);
    });
  });

  describe('message-ack handling', () => {
    it('acknowledges a sent message', () => {
      const { result } = renderHook(() => useMessageSync({ sendMessage }));

      let messageId: string;
      act(() => {
        messageId = result.current.sendChatMessage('Ack me');
      });

      act(() => {
        result.current.handleMessage({
          type: 'message-ack',
          messageId: messageId!,
        });
      });

      const messages = useMessagesStore.getState().messages;
      expect(messages[0].acknowledged).toBe(true);
    });
  });

  describe('unknown message types', () => {
    it('ignores unknown types', () => {
      const { result } = renderHook(() => useMessageSync({ sendMessage }));

      act(() => {
        result.current.handleMessage({ type: 'unknown-type' } as unknown as DataChannelMessage);
      });

      expect(useMessagesStore.getState().messages).toHaveLength(0);
    });
  });
});

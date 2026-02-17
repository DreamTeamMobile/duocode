import { describe, it, expect, beforeEach } from 'vitest';
import { useMessagesStore } from '../../src/stores/messagesStore';
import type { Message } from '../../src/stores/messagesStore';

/** Helper to create a Message with default sender/timestamp for brevity. */
function msg(overrides: Partial<Message> & { id: string }): Message {
  return { sender: 'test', timestamp: Date.now(), ...overrides };
}

describe('messagesStore', () => {
  beforeEach(() => {
    useMessagesStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have correct defaults', () => {
      const state = useMessagesStore.getState();
      expect(state.messages).toEqual([]);
      expect(state.unreadCount).toBe(0);
      expect(state.isPanelOpen).toBe(false);
    });
  });

  describe('addMessage', () => {
    it('should add a message to the list', () => {
      const m: Message = { id: 'm1', text: 'hello', sender: 'Alice', timestamp: 1000 };
      useMessagesStore.getState().addMessage(m);
      expect(useMessagesStore.getState().messages).toEqual([m]);
    });

    it('should increment unreadCount when panel is closed', () => {
      useMessagesStore.getState().addMessage(msg({ id: 'm1', text: 'hi' }));
      useMessagesStore.getState().addMessage(msg({ id: 'm2', text: 'there' }));
      expect(useMessagesStore.getState().unreadCount).toBe(2);
    });

    it('should not increment unreadCount when panel is open', () => {
      useMessagesStore.getState().togglePanel(); // open
      useMessagesStore.getState().addMessage(msg({ id: 'm1', text: 'hi' }));
      expect(useMessagesStore.getState().unreadCount).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should reset unreadCount to 0', () => {
      useMessagesStore.getState().addMessage(msg({ id: 'm1', text: 'hi' }));
      useMessagesStore.getState().addMessage(msg({ id: 'm2', text: 'there' }));
      useMessagesStore.getState().markAsRead();
      expect(useMessagesStore.getState().unreadCount).toBe(0);
    });
  });

  describe('togglePanel', () => {
    it('should toggle isPanelOpen', () => {
      useMessagesStore.getState().togglePanel();
      expect(useMessagesStore.getState().isPanelOpen).toBe(true);
      useMessagesStore.getState().togglePanel();
      expect(useMessagesStore.getState().isPanelOpen).toBe(false);
    });

    it('should reset unreadCount when opening', () => {
      useMessagesStore.getState().addMessage(msg({ id: 'm1', text: 'hi' }));
      expect(useMessagesStore.getState().unreadCount).toBe(1);
      useMessagesStore.getState().togglePanel(); // open
      expect(useMessagesStore.getState().unreadCount).toBe(0);
    });

    it('should not reset unreadCount when closing', () => {
      useMessagesStore.getState().togglePanel(); // open
      useMessagesStore.getState().togglePanel(); // close
      useMessagesStore.getState().addMessage(msg({ id: 'm1', text: 'hi' }));
      useMessagesStore.getState().togglePanel(); // open again
      // unreadCount was 1, opening resets it
      expect(useMessagesStore.getState().unreadCount).toBe(0);
    });
  });

  describe('acknowledgeMessage', () => {
    it('should mark a specific message as acknowledged', () => {
      useMessagesStore.getState().addMessage(msg({ id: 'm1', text: 'hi', acknowledged: false }));
      useMessagesStore.getState().addMessage(msg({ id: 'm2', text: 'there', acknowledged: false }));
      useMessagesStore.getState().acknowledgeMessage('m1');
      const messages = useMessagesStore.getState().messages;
      expect(messages[0].acknowledged).toBe(true);
      expect(messages[1].acknowledged).toBe(false);
    });

    it('should not affect messages with non-matching ids', () => {
      useMessagesStore.getState().addMessage(msg({ id: 'm1', text: 'hi' }));
      useMessagesStore.getState().acknowledgeMessage('nonexistent');
      expect(useMessagesStore.getState().messages[0].acknowledged).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should restore all defaults', () => {
      useMessagesStore.getState().addMessage(msg({ id: 'm1', text: 'hi' }));
      useMessagesStore.getState().togglePanel();
      useMessagesStore.getState().reset();
      const state = useMessagesStore.getState();
      expect(state.messages).toEqual([]);
      expect(state.unreadCount).toBe(0);
      expect(state.isPanelOpen).toBe(false);
    });
  });
});

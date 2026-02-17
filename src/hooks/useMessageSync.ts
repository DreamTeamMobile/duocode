import { useCallback, useEffect, useRef } from 'react';
import { useMessagesStore } from '../stores/messagesStore';
import { useSessionStore } from '../stores/sessionStore';
import { MessageDeduplicator } from '../services/messages-logic';
import type { DataChannelMessage } from '../services/connection-manager';

interface UseMessageSyncOptions {
  sendMessage?: (data: DataChannelMessage) => boolean;
}

interface UseMessageSyncReturn {
  handleMessage: (message: DataChannelMessage) => void;
  sendChatMessage: (text: string) => string;
}

/**
 * useMessageSync — sends/receives chat messages over a data channel.
 *
 * - Automatically sends new local messages to peers when added to the store.
 * - Provides `sendChatMessage` helper to broadcast a local message.
 * - Handles incoming `message` and `message-ack` types.
 * - Deduplicates messages to prevent duplicates in mesh topology.
 */
export function useMessageSync({ sendMessage }: UseMessageSyncOptions = {}): UseMessageSyncReturn {
  const deduplicatorRef = useRef(new MessageDeduplicator());
  const isRemoteUpdateRef = useRef(false);
  const previousMessagesLenRef = useRef(0);

  const messages = useMessagesStore((s) => s.messages);
  const addMessage = useMessagesStore((s) => s.addMessage);
  const acknowledgeMessage = useMessagesStore((s) => s.acknowledgeMessage);
  const peerName = useSessionStore((s) => s.peerName);

  const sendChatMessage = useCallback((text: string): string => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const message = {
      id,
      content: text,
      sender: peerName || 'You',
      timestamp: Date.now(),
      isSelf: true,
    };

    addMessage(message);
    deduplicatorRef.current.markSeen(id);

    if (sendMessage) {
      sendMessage({
        type: 'message',
        id,
        text,
        sender: peerName || 'Anonymous',
        timestamp: message.timestamp,
      });
    }

    return id;
  }, [addMessage, peerName, sendMessage]);

  const handleMessage = useCallback((message: DataChannelMessage) => {
    switch (message.type) {
      case 'message': {
        if (!message.id || deduplicatorRef.current.hasSeen(message.id)) {
          return; // Already seen — skip duplicate
        }
        deduplicatorRef.current.markSeen(message.id);

        isRemoteUpdateRef.current = true;
        addMessage({
          id: message.id,
          content: message.text,
          sender: message.sender || 'Anonymous',
          timestamp: message.timestamp || Date.now(),
          isSelf: false,
        });

        // Send acknowledgment back
        if (sendMessage) {
          sendMessage({
            type: 'message-ack',
            messageId: message.id,
          });
        }
        break;
      }

      case 'message-ack': {
        if (message.messageId) {
          acknowledgeMessage(message.messageId);
        }
        break;
      }

      default:
        break;
    }
  }, [addMessage, acknowledgeMessage, sendMessage]);

  // Expose sendChatMessage to MessageInput via the store
  useEffect(() => {
    useMessagesStore.setState({ _sendChatFn: sendChatMessage });
    return () => {
      useMessagesStore.setState({ _sendChatFn: null });
    };
  }, [sendChatMessage]);

  return { handleMessage, sendChatMessage };
}

import { useState, useCallback, useRef, type KeyboardEvent } from 'react';
import { useMessagesStore } from '../../stores/messagesStore';
import { useSessionStore } from '../../stores/sessionStore';

export default function MessageInput() {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Use the broadcast function injected by useMessageSync — this
    // both adds the message locally AND sends it over WebRTC.
    const sendChatFn = useMessagesStore.getState()._sendChatFn;
    if (sendChatFn) {
      sendChatFn(trimmed);
    } else {
      // Fallback: local-only when sync layer is not yet initialised
      const peerName = useSessionStore.getState().peerName;
      useMessagesStore.getState().addMessage({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sender: peerName || 'You',
        content: trimmed,
        timestamp: Date.now(),
        isSelf: true,
      });
    }

    setText('');
    textareaRef.current?.focus();
  }, [text]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div id="messageInput">
      <textarea
        ref={textareaRef}
        id="messageText"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        rows={1}
      />
      <button
        id="sendMessageBtn"
        className="primary-btn"
        onClick={handleSend}
        disabled={!text.trim()}
        title="Send message"
      >
        Send
      </button>
    </div>
  );
}

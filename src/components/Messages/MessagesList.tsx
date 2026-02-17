import { useEffect, useRef } from 'react';
import { useMessagesStore } from '../../stores/messagesStore';
import { formatTimestamp } from '../../services/messages-logic';

interface MessageStatusProps {
  acknowledged: boolean;
}

function MessageStatus({ acknowledged }: MessageStatusProps) {
  return (
    <span className="message-status" title={acknowledged ? 'Delivered' : 'Sent'}>
      {acknowledged ? (
        <svg width="16" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 5 4 8 9 2" />
          <polyline points="6 5 9 8 14 2" />
        </svg>
      ) : (
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 5 4 8 11 2" />
        </svg>
      )}
    </span>
  );
}

export default function MessagesList() {
  const messages = useMessagesStore((s) => s.messages);
  const listRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    function onScroll() {
      const threshold = 40;
      isAtBottomRef.current =
        el!.scrollHeight - el!.scrollTop - el!.clientHeight < threshold;
    }

    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (isAtBottomRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div id="messagesList" ref={listRef}>
      {messages.length === 0 && (
        <div className="messages-empty">No messages yet</div>
      )}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`message ${msg.isSelf ? 'message-self' : 'message-other'}`}
        >
          <div className="message-header">
            <span className="message-role">{msg.sender}</span>
            <span className="message-timestamp">
              {formatTimestamp(msg.timestamp)}
            </span>
          </div>
          <div className="message-text">{msg.content}</div>
          {msg.isSelf && (
            <div className="message-footer">
              <MessageStatus acknowledged={!!msg.acknowledged} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

import { useMessagesStore } from '../../stores/messagesStore';

export default function MessagesFAB() {
  const unreadCount = useMessagesStore((s) => s.unreadCount);
  const togglePanel = useMessagesStore((s) => s.togglePanel);

  return (
    <button
      className="messages-fab"
      onClick={togglePanel}
      title="Toggle messages"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {unreadCount > 0 && (
        <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
      )}
    </button>
  );
}

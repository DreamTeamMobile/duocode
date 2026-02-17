import { useMessagesStore } from '../../stores/messagesStore';
import ParticipantsList from './ParticipantsList';
import MessagesList from './MessagesList';
import MessageInput from './MessageInput';

export default function MessagesPanel() {
  const isPanelOpen = useMessagesStore((s) => s.isPanelOpen);
  const togglePanel = useMessagesStore((s) => s.togglePanel);

  return (
    <div
      className={`messages-panel desktop-panel ${isPanelOpen ? 'mobile-open' : 'collapsed'}`}
    >
      <div className="messages-header">
        <h2>Messages</h2>
        <button
          className="close-messages-btn"
          onClick={togglePanel}
          title="Close messages"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div id="messagesBlock">
        <ParticipantsList />
        <MessagesList />
        <MessageInput />
      </div>
    </div>
  );
}

import { useMessagesStore } from '../../stores/messagesStore';

/**
 * Mobile-only backdrop that appears behind the messages panel.
 * Clicking it closes the panel. Hidden on desktop via CSS.
 */
export default function MessagesOverlay() {
  const isPanelOpen = useMessagesStore((s) => s.isPanelOpen);
  const togglePanel = useMessagesStore((s) => s.togglePanel);

  return (
    <div
      className={`messages-overlay ${isPanelOpen ? 'open' : ''}`}
      onClick={togglePanel}
    />
  );
}

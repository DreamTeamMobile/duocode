import { useUIStore } from '../../stores/uiStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useMessagesStore } from '../../stores/messagesStore';
import { useCanvasStore } from '../../stores/canvasStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { generateSessionId, updateURLWithSession } from '../../services/session-logic';

export default function NewSessionModal() {
  const isOpen = useUIStore((s) => s.isNewSessionModalOpen);
  const hideNewSessionModal = useUIStore((s) => s.hideNewSessionModal);
  const createSession = useSessionStore((s) => s.createSession);

  if (!isOpen) return null;

  const handleConfirm = () => {
    // Reset all stores
    useEditorStore.getState().reset();
    useMessagesStore.getState().reset();
    useCanvasStore.getState().reset();
    useConnectionStore.getState().reset();
    useSessionStore.getState().reset();

    // Generate new session ID, create session, and update URL
    const newSessionId = generateSessionId();
    createSession(newSessionId);
    updateURLWithSession(newSessionId);
    hideNewSessionModal();
  };

  return (
    <div className="modal" data-testid="new-session-modal">
      <div className="modal-content">
        <h2>New Session</h2>
        <p className="modal-subtitle">
          Are you sure you want to start a new session? All current session data
          will be lost.
        </p>
        <div className="modal-buttons">
          <button className="btn-secondary" onClick={hideNewSessionModal}>
            Cancel
          </button>
          <button className="btn-danger" onClick={handleConfirm}>
            Start New Session
          </button>
        </div>
      </div>
    </div>
  );
}

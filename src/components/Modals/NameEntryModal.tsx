import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useSessionStore } from '../../stores/sessionStore';
import { PARTICIPANT_NAME_KEY } from '../../services/session-logic';

export default function NameEntryModal() {
  const isOpen = useUIStore((s) => s.isNameModalOpen);
  const hideNameModal = useUIStore((s) => s.hideNameModal);
  const peerName = useSessionStore((s) => s.peerName);
  const setPeerName = useSessionStore((s) => s.setPeerName);

  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Pre-fill: use current peerName, or fall back to the global saved name
      const globalName = localStorage.getItem(PARTICIPANT_NAME_KEY) || '';
      setName(peerName || globalName);
      setError('');
      // Focus the input on open
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, peerName]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name');
      return;
    }
    setPeerName(trimmed);
    hideNameModal();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="modal" data-testid="name-entry-modal">
      <div className="modal-content">
        <h2>Join Session</h2>
        <p className="modal-subtitle">Enter your name to join the coding session</p>
        <input
          ref={inputRef}
          id="participantNameInput"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={handleKeyDown}
          placeholder="Your name"
          maxLength={30}
          autoComplete="off"
        />
        <div className="error-message">{error}</div>
        <button id="joinSessionBtn" onClick={handleSubmit} disabled={!name.trim()}>
          Join
        </button>
      </div>
    </div>
  );
}

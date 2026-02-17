import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import { useSessionStore, type Participant } from '../../stores/sessionStore';
import { useConnectionStore } from '../../stores/connectionStore';

interface ConnectionQualityDotProps {
  peerId: string;
}

function ConnectionQualityDot({ peerId }: ConnectionQualityDotProps) {
  const peerConnections = useConnectionStore((s) => s.peerConnections);
  const peerStatus = peerConnections[peerId];

  let dotClass = '';
  if (!peerStatus || peerStatus === 'disconnected') {
    dotClass = 'disconnected';
  } else if (peerStatus === 'connecting') {
    dotClass = 'connecting';
  }

  return <span className={`connection-dot ${dotClass}`} />;
}

interface ParticipantItemProps {
  peerId: string;
  participant: Participant;
  isSelf: boolean;
  onNameChange: (name: string) => void;
}

function ParticipantItem({ peerId, participant, isSelf, onNameChange }: ParticipantItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEditing = useCallback(() => {
    if (!isSelf) return;
    setEditValue(participant.name || '');
    setIsEditing(true);
  }, [isSelf, participant.name]);

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== participant.name) {
      onNameChange(trimmed);
    }
    setIsEditing(false);
  }, [editValue, participant.name, onNameChange]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
      }
    },
    [commitEdit]
  );

  return (
    <li className={`participant-item ${isSelf ? 'is-self' : ''}`}>
      {!isSelf && <ConnectionQualityDot peerId={peerId} />}
      {isEditing ? (
        <input
          ref={inputRef}
          className="name-edit-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          maxLength={30}
        />
      ) : (
        <span
          className={`participant-name ${isSelf ? 'editable' : ''}`}
          onClick={startEditing}
        >
          {participant.name || 'Anonymous'}
          {isSelf && ' (you)'}
        </span>
      )}
      {isSelf && !isEditing && (
        <button
          className="edit-name-btn"
          onClick={startEditing}
          title="Edit your name"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      )}
      {participant.isHost && (
        <span className="host-badge" title="Host">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </span>
      )}
    </li>
  );
}

export default function ParticipantsList() {
  const [collapsed, setCollapsed] = useState(false);
  const participants = useSessionStore((s) => s.participants);
  const peerName = useSessionStore((s) => s.peerName);
  const isHost = useSessionStore((s) => s.isHost);
  const setPeerName = useSessionStore((s) => s.setPeerName);

  const localParticipant: Participant = {
    name: peerName || 'You',
    isHost,
  };

  const remoteEntries = Object.entries(participants);
  const totalCount = 1 + remoteEntries.length;

  return (
    <div className={`participants-section ${collapsed ? 'collapsed' : ''}`}>
      <div
        className="participants-header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span>Participants ({totalCount})</span>
        <span className="toggle-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>
      <ul className="participants-list">
        <ParticipantItem
          peerId="self"
          participant={localParticipant}
          isSelf={true}
          onNameChange={setPeerName}
        />
        {remoteEntries.map(([peerId, participant]) => (
          <ParticipantItem
            key={peerId}
            peerId={peerId}
            participant={participant}
            isSelf={false}
            onNameChange={() => {}}
          />
        ))}
      </ul>
    </div>
  );
}

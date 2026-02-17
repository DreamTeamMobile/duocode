import { useRef, useEffect, useCallback } from 'react';

interface TextInputOverlayProps {
  position: { left: number; top: number };
  onCommit: (text: string) => void;
  onDismiss: () => void;
}

export default function TextInputOverlay({ position, onCommit, onDismiss }: TextInputOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onCommit(inputRef.current?.value ?? '');
      } else if (e.key === 'Escape') {
        onDismiss();
      }
    },
    [onCommit, onDismiss],
  );

  const handleBlur = useCallback(() => {
    // Re-focus if blur happens within 300ms of mount — prevents the mouseup
    // from the initial canvas click from stealing focus
    if (Date.now() - mountedAtRef.current < 300) {
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    const value = inputRef.current?.value;
    if (value?.trim()) {
      onCommit(value);
    } else {
      onDismiss();
    }
  }, [onCommit, onDismiss]);

  return (
    <div
      className="text-input-overlay"
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
      }}
    >
      <input
        ref={inputRef}
        id="canvasTextInput"
        type="text"
        placeholder="Enter text..."
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    </div>
  );
}

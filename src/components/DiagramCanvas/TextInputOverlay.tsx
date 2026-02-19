import { useRef, useEffect, useCallback } from 'react';

interface TextInputOverlayProps {
  position: { left: number; top: number };
  onCommit: (text: string) => void;
  onDismiss: () => void;
  initialText?: string;
  shapeEditing?: boolean;
}

export default function TextInputOverlay({ position, onCommit, onDismiss, initialText, shapeEditing }: TextInputOverlayProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mountedAtRef = useRef(Date.now());
  const committedRef = useRef(false);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    if (initialText) {
      el.value = initialText;
      // Place cursor at end
      el.selectionStart = el.selectionEnd = initialText.length;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        // Ctrl+Enter / Cmd+Enter → commit
        e.preventDefault();
        committedRef.current = true;
        onCommit(inputRef.current?.value ?? '');
      } else if (e.key === 'Escape') {
        committedRef.current = true;
        onDismiss();
      }
      // Plain Enter = default textarea newline behavior (no preventDefault)
    },
    [onCommit, onDismiss],
  );

  const handleBlur = useCallback(() => {
    if (committedRef.current) return;

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

  const handleInput = useCallback(() => {
    // Auto-resize textarea height to fit content
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  return (
    <div
      className={`text-input-overlay${shapeEditing ? ' shape-editing' : ''}`}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
      }}
    >
      <textarea
        ref={inputRef}
        id="canvasTextInput"
        placeholder="Enter text..."
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onInput={handleInput}
        rows={1}
      />
    </div>
  );
}

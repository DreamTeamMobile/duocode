import { RefObject } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { calculateCursorPosition, isCursorVisible } from '../../services/code-editor-logic';

const CURSOR_COLORS = [
  '#ff4444',
  '#44aaff',
  '#44ff44',
  '#ffaa44',
  '#ff44ff',
  '#44ffff',
];

const LINE_HEIGHT = 21; // 14px * 1.5 line-height
const CHAR_WIDTH = 8.4; // Approximate monospace char width at 14px
const PADDING = 12;

interface RemoteCursorsProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export default function RemoteCursors({ textareaRef }: RemoteCursorsProps) {
  const remoteCursors = useEditorStore((s) => s.remoteCursors);
  const code = useEditorStore((s) => s.code);

  const peerIds = Object.keys(remoteCursors);
  if (peerIds.length === 0) return null;

  const scrollTop = textareaRef.current?.scrollTop || 0;
  const scrollLeft = textareaRef.current?.scrollLeft || 0;
  const visibleHeight = textareaRef.current?.clientHeight || 600;
  const visibleWidth = textareaRef.current?.clientWidth || 800;

  return (
    <>
      {peerIds.map((peerId, index) => {
        const cursor = remoteCursors[peerId];
        const color = cursor.color || CURSOR_COLORS[index % CURSOR_COLORS.length];

        const { top, left } = calculateCursorPosition(
          code,
          cursor.position ?? 0,
          LINE_HEIGHT,
          PADDING,
          PADDING,
          CHAR_WIDTH,
          scrollTop,
          scrollLeft,
        );

        if (!isCursorVisible(top, left, visibleHeight, visibleWidth)) {
          return null;
        }

        return (
          <div
            key={peerId}
            className="remote-cursor"
            style={{
              position: 'absolute',
              top: `${top}px`,
              left: `${left}px`,
              width: '2px',
              height: `${LINE_HEIGHT}px`,
              backgroundColor: color,
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          >
            <span
              className="remote-cursor-label"
              style={{
                position: 'absolute',
                top: '-20px',
                left: 0,
                fontSize: '11px',
                backgroundColor: color,
                color: 'white',
                padding: '2px 5px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
              }}
            >
              {cursor.name || peerId.slice(0, 6)}
            </span>
          </div>
        );
      })}
    </>
  );
}

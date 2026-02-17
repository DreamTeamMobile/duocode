import { useCallback, type ReactNode } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import type { CanvasTool } from '../../services/canvas-logic';

interface ToolDefinition {
  id: CanvasTool;
  title: string;
  icon: ReactNode;
}

const TOOLS: ToolDefinition[] = [
  {
    id: 'pen',
    title: 'Pen',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      </svg>
    ),
  },
  {
    id: 'line',
    title: 'Line',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="5" y1="19" x2="19" y2="5" />
      </svg>
    ),
  },
  {
    id: 'rectangle',
    title: 'Rectangle',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    ),
  },
  {
    id: 'circle',
    title: 'Circle',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    id: 'text',
    title: 'Text',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </svg>
    ),
  },
  {
    id: 'pan',
    title: 'Pan/Move Canvas',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 9l-3 3 3 3" />
        <path d="M9 5l3-3 3 3" />
        <path d="M15 19l-3 3-3-3" />
        <path d="M19 9l3 3-3 3" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="12" y1="2" x2="12" y2="22" />
      </svg>
    ),
  },
];

const ERASER: ToolDefinition = {
  id: 'eraser',
  title: 'Eraser',
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </svg>
  ),
};

export default function CanvasToolbar() {
  const currentTool = useCanvasStore((s) => s.currentTool);
  const strokeColor = useCanvasStore((s) => s.strokeColor);
  const strokeWidth = useCanvasStore((s) => s.strokeWidth);
  const undoHistory = useCanvasStore((s) => s.undoHistory);
  const redoHistory = useCanvasStore((s) => s.redoHistory);
  const setTool = useCanvasStore((s) => s.setTool);
  const setStrokeColor = useCanvasStore((s) => s.setStrokeColor);
  const setStrokeWidth = useCanvasStore((s) => s.setStrokeWidth);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const clear = useCanvasStore((s) => s.clear);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const setPan = useCanvasStore((s) => s.setPan);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [setZoom, setPan]);

  return (
    <div id="diagramControls">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          className={`tool-btn-icon${currentTool === tool.id ? ' active' : ''}`}
          data-tool={tool.id}
          title={tool.title}
          onClick={() => setTool(tool.id)}
        >
          {tool.icon}
        </button>
      ))}

      <span className="tool-divider" />

      <button
        className="tool-btn-icon"
        title="Undo (Ctrl+Z)"
        disabled={undoHistory.length === 0}
        onClick={undo}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
      </button>
      <button
        className="tool-btn-icon"
        title="Redo (Ctrl+Y)"
        disabled={redoHistory.length === 0}
        onClick={redo}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 7v6h-6" />
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
        </svg>
      </button>

      <span className="tool-divider" />

      <button
        className={`tool-btn-icon${currentTool === 'eraser' ? ' active' : ''}`}
        data-tool="eraser"
        title={ERASER.title}
        onClick={() => setTool('eraser')}
      >
        {ERASER.icon}
      </button>

      <input
        type="color"
        id="colorPicker"
        value={strokeColor}
        title="Color"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStrokeColor(e.target.value)}
      />

      <div className="size-control-wrapper">
        <input
          type="range"
          className="size-slider"
          min="1"
          max="20"
          value={strokeWidth}
          title="Brush size"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStrokeWidth(Number(e.target.value))}
        />
        <span className="size-value">{strokeWidth}</span>
      </div>

      <button
        className="tool-btn-icon"
        title="Clear Canvas"
        onClick={clear}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        </svg>
      </button>

      <button
        className="tool-btn-icon"
        title="Reset Zoom"
        onClick={handleResetZoom}
      >
        1:1
      </button>
    </div>
  );
}

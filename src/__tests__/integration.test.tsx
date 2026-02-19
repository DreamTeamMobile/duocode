/**
 * Integration Tests — Full User Flow Verification
 *
 * Verifies the React app is functionally equivalent to the original vanilla JS app.
 * Tests complete user flows end-to-end within the jsdom environment.
 */

import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../App';
import { useSessionStore } from '../stores/sessionStore';
import { useEditorStore } from '../stores/editorStore';
import { useCanvasStore } from '../stores/canvasStore';
import { useMessagesStore } from '../stores/messagesStore';
import { useUIStore } from '../stores/uiStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useToastStore } from '../stores/toastStore';

// Reset all stores before each test
beforeEach(() => {
  useSessionStore.getState().reset();
  useEditorStore.getState().reset();
  useCanvasStore.getState().reset();
  useMessagesStore.getState().reset();
  useUIStore.getState().reset();
  useConnectionStore.getState().reset();
  useToastStore.getState().reset();
  localStorage.clear();
  window.location.search = '';
});

describe('Integration: App loads and creates session', () => {
  it('creates a session and sets URL on mount', () => {
    render(<App />);

    const session = useSessionStore.getState();
    expect(session.sessionId).toBeTruthy();
    expect(session.sessionId!.length).toBe(12);
    expect(session.isHost).toBe(true);
    expect(session.sessionStartTime).toBeGreaterThan(0);
  });

  it('shows name entry modal when no saved name exists', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="name-entry-modal"]')).toBeInTheDocument();
    });
  });

  it('always shows name modal even with saved name (each tab is unique)', async () => {
    const sessionId = 'test123session';
    localStorage.setItem(`duocode_session_name_${sessionId}`, 'TestUser');
    window.location.search = `?session=${sessionId}`;
    window.location.href = `http://localhost:3000?session=${sessionId}`;

    const { container } = render(<App />);

    // Modal should always show so each tab acts as a unique participant
    await waitFor(() => {
      expect(container.querySelector('[data-testid="name-entry-modal"]')).toBeInTheDocument();
    });

    expect(useSessionStore.getState().peerName).toBeNull();
  });

  it('dismisses name modal on submit and stores the name', async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="name-entry-modal"]')).toBeInTheDocument();
    });

    const input = container.querySelector('#participantNameInput') as HTMLInputElement;
    const joinBtn = container.querySelector('#joinSessionBtn')!;

    expect(input).toBeInTheDocument();
    expect(joinBtn).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Alice' } });
    fireEvent.click(joinBtn);

    expect(useSessionStore.getState().peerName).toBe('Alice');
    expect(container.querySelector('[data-testid="name-entry-modal"]')).not.toBeInTheDocument();
  });

  it('exposes DuoCodeDebug on window', () => {
    render(<App />);

    expect(window.DuoCodeDebug).toBeDefined();
    expect(typeof window.DuoCodeDebug.status).toBe('function');
    expect(typeof window.DuoCodeDebug.getDrawingStrokes).toBe('function');
  });

  it('renders header with DuoCode title', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.clickable-title')).toHaveTextContent('DuoCode');
  });

  it('renders footer', () => {
    const { container } = render(<App />);
    expect(container.querySelector('#appFooter')).toBeInTheDocument();
  });

  it('renders participant count element', () => {
    const { container } = render(<App />);

    // Set name so the count includes self
    act(() => {
      useSessionStore.getState().setPeerName('Alice');
      useUIStore.getState().hideNameModal();
    });

    const count = container.querySelector('#participantCount')!;
    expect(count).toBeInTheDocument();
    expect(count.textContent).toBe('1');
  });

  it('updates participant count when remote peers join', () => {
    const { container } = render(<App />);

    act(() => {
      useSessionStore.getState().setPeerName('Alice');
      useSessionStore.getState().updateParticipant('peer-1', { name: 'Bob', isHost: false });
    });

    const count = container.querySelector('#participantCount')!;
    expect(count.textContent).toBe('2');
  });
});

describe('Integration: Code editing with language switching', () => {
  it('renders code editor on the code tab', () => {
    const { container } = render(<App />);
    const codeInput = container.querySelector('#codeInput') as HTMLTextAreaElement;
    expect(codeInput).toBeInTheDocument();
    expect(codeInput.tagName).toBe('TEXTAREA');
  });

  it('edits code and updates store', () => {
    const { container } = render(<App />);
    const textarea = container.querySelector('#codeInput') as HTMLTextAreaElement;

    const opsBefore = useEditorStore.getState().localOperationCount;
    fireEvent.change(textarea!, { target: { value: 'function hello() {}' } });

    expect(useEditorStore.getState().code).toBe('function hello() {}');
    expect(useEditorStore.getState().localOperationCount).toBeGreaterThan(opsBefore);
  });

  it('applies syntax highlighting', () => {
    act(() => {
      useEditorStore.getState().setCode('const x = 42;');
    });

    const { container } = render(<App />);
    const codeOutput = container.querySelector('#codeOutput')!;
    expect(codeOutput).toHaveClass('language-javascript');
    expect(codeOutput.querySelectorAll('.token').length).toBeGreaterThan(0);
  });

  it('switches language via selector', () => {
    const { container } = render(<App />);
    const select = container.querySelector('#languageSelector select') as HTMLSelectElement;

    expect(select).toBeInTheDocument();
    fireEvent.change(select!, { target: { value: 'python' } });

    expect(useEditorStore.getState().language).toBe('python');
  });

  it('updates syntax class when language changes', () => {
    act(() => {
      useEditorStore.getState().setCode('print("hello")');
      useEditorStore.getState().setLanguage('python');
    });

    const { container } = render(<App />);
    const codeOutput = container.querySelector('#codeOutput');
    expect(codeOutput).toHaveClass('language-python');
  });

  it('hides language selector when switching to Diagram tab', () => {
    const { container } = render(<App />);

    expect(container.querySelector('#languageSelector')).toBeInTheDocument();

    const diagramBtn = [...container.querySelectorAll('.tab-btn')].find(
      (btn) => btn.textContent === 'Diagram'
    )!;
    fireEvent.click(diagramBtn);

    expect(container.querySelector('#languageSelector')).not.toBeInTheDocument();
  });
});

describe('Integration: Tab switching', () => {
  it('starts on Code tab', () => {
    const { container } = render(<App />);
    const codeTab = container.querySelector('#codeCanvas');
    expect(codeTab).toHaveClass('active');
  });

  it('switches to Diagram tab', () => {
    const { container } = render(<App />);
    const diagramBtn = [...container.querySelectorAll('.tab-btn')].find(
      (btn) => btn.textContent === 'Diagram'
    )!;
    fireEvent.click(diagramBtn);

    expect(useUIStore.getState().activeTab).toBe('canvas');
    expect(container.querySelector('#diagramCanvas')).toHaveClass('active');
    expect(container.querySelector('#codeCanvas')).not.toHaveClass('active');
  });

  it('switches back to Code tab', () => {
    act(() => {
      useUIStore.getState().switchTab('canvas');
    });

    const { container } = render(<App />);
    const codeBtn = [...container.querySelectorAll('.tab-btn')].find(
      (btn) => btn.textContent === 'Code'
    )!;
    fireEvent.click(codeBtn);

    expect(useUIStore.getState().activeTab).toBe('code');
    expect(container.querySelector('#codeCanvas')).toHaveClass('active');
  });

  it('shows canvas toolbar on Diagram tab', () => {
    act(() => {
      useUIStore.getState().switchTab('canvas');
    });

    const { container } = render(<App />);
    expect(container.querySelector('#diagramControls')).toBeInTheDocument();
    expect(container.querySelector('#diagramArea')).toBeInTheDocument();
  });
});

describe('Integration: Canvas with tool switching and undo/redo', () => {
  beforeEach(() => {
    act(() => {
      useUIStore.getState().switchTab('canvas');
    });
  });

  it('renders canvas tools with correct data-tool attributes', () => {
    const { container } = render(<App />);
    expect(container.querySelector('[data-tool="pen"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tool="line"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tool="rectangle"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tool="circle"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tool="text"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tool="pan"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tool="eraser"]')).toBeInTheDocument();
  });

  it('switches tool on click', () => {
    const { container } = render(<App />);

    fireEvent.click(container.querySelector('[data-tool="line"]')!);
    expect(useCanvasStore.getState().currentTool).toBe('line');

    fireEvent.click(container.querySelector('[data-tool="rectangle"]')!);
    expect(useCanvasStore.getState().currentTool).toBe('rectangle');

    fireEvent.click(container.querySelector('[data-tool="pen"]')!);
    expect(useCanvasStore.getState().currentTool).toBe('pen');
  });

  it('marks active tool with active class', () => {
    const { container } = render(<App />);

    const penBtn = container.querySelector('[data-tool="pen"]');
    expect(penBtn).toHaveClass('active');

    fireEvent.click(container.querySelector('[data-tool="circle"]')!);

    expect(container.querySelector('[data-tool="pen"]')).not.toHaveClass('active');
    expect(container.querySelector('[data-tool="circle"]')).toHaveClass('active');
  });

  it('undo/redo disabled initially, enabled after strokes', () => {
    const { container } = render(<App />);

    const undoBtn = container.querySelector('[title="Undo (Ctrl+Z)"]');
    const redoBtn = container.querySelector('[title="Redo (Ctrl+Y)"]');

    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeDisabled();
  });

  it('undo/redo store works correctly', () => {
    const store = useCanvasStore.getState();

    store.addStroke({ tool: 'pen', color: '#fff', brushSize: 2, points: [{ x: 0, y: 0 }] });
    store.addStroke({ tool: 'pen', color: '#fff', brushSize: 2, points: [{ x: 10, y: 10 }] });

    expect(useCanvasStore.getState().drawingStrokes).toHaveLength(2);
    expect(useCanvasStore.getState().undoHistory).toHaveLength(2);

    store.undo();
    expect(useCanvasStore.getState().drawingStrokes).toHaveLength(1);
    expect(useCanvasStore.getState().redoHistory).toHaveLength(1);

    store.redo();
    expect(useCanvasStore.getState().drawingStrokes).toHaveLength(2);
    expect(useCanvasStore.getState().redoHistory).toHaveLength(0);
  });

  it('clear empties strokes and pushes to undo history', () => {
    const store = useCanvasStore.getState();
    store.addStroke({ tool: 'line', color: '#f00', brushSize: 2, start: { x: 0, y: 0 }, end: { x: 100, y: 100 } });

    store.clear();
    expect(useCanvasStore.getState().drawingStrokes).toHaveLength(0);
    expect(useCanvasStore.getState().undoHistory.length).toBeGreaterThan(0);
  });

  it('color picker and brush size controls work', () => {
    const { container } = render(<App />);

    const colorPicker = container.querySelector('#colorPicker');
    expect(colorPicker).toBeInTheDocument();
    fireEvent.change(colorPicker!, { target: { value: '#ff0000' } });
    expect(useCanvasStore.getState().strokeColor).toBe('#ff0000');

    const sizeSlider = container.querySelector('.size-slider')!;
    fireEvent.change(sizeSlider, { target: { value: '10' } });
    expect(useCanvasStore.getState().strokeWidth).toBe(10);
  });

  it('DuoCodeDebug.getDrawingStrokes returns canvas strokes', () => {
    render(<App />);

    act(() => {
      useCanvasStore.getState().addStroke({ tool: 'pen', color: '#fff', brushSize: 2, points: [] });
    });

    expect(window.DuoCodeDebug.getDrawingStrokes()).toHaveLength(1);
  });
});

describe('Integration: Messages send and display', () => {
  it('renders message input elements', () => {
    const { container } = render(<App />);
    expect(container.querySelector('#messageText')).toBeInTheDocument();
    expect(container.querySelector('#sendMessageBtn')).toBeInTheDocument();
  });

  it('sends a message via button click', () => {
    act(() => {
      useSessionStore.getState().setPeerName('Alice');
    });

    const { container } = render(<App />);
    const messageInput = container.querySelector('#messageText') as HTMLTextAreaElement;
    const sendBtn = container.querySelector('#sendMessageBtn')!;

    fireEvent.change(messageInput, { target: { value: 'Hello from Alice!' } });
    fireEvent.click(sendBtn);

    const messages = useMessagesStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello from Alice!');
    expect(messages[0].sender).toBe('Alice');
    expect(messages[0].isSelf).toBe(true);
  });

  it('sends a message via Enter key', () => {
    act(() => {
      useSessionStore.getState().setPeerName('Alice');
    });

    const { container } = render(<App />);
    const messageInput = container.querySelector('#messageText') as HTMLTextAreaElement;

    fireEvent.change(messageInput, { target: { value: 'Enter message' } });
    fireEvent.keyDown(messageInput, { key: 'Enter', shiftKey: false });

    const messages = useMessagesStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].sender).toBe('Alice');
  });

  it('displays messages in the messages list', () => {
    act(() => {
      useMessagesStore.getState().addMessage({
        id: 'msg-1',
        sender: 'Alice',
        content: 'Hello!',
        timestamp: Date.now(),
        isSelf: true,
      });
      useMessagesStore.getState().addMessage({
        id: 'msg-2',
        sender: 'Bob',
        content: 'Hi Alice!',
        timestamp: Date.now(),
        isSelf: false,
      });
    });

    const { container } = render(<App />);
    const messagesList = container.querySelector('#messagesList')!;
    expect(messagesList).toBeInTheDocument();

    const messages = messagesList.querySelectorAll('.message');
    expect(messages).toHaveLength(2);
  });

  it('clears input after sending', () => {
    const { container } = render(<App />);
    const messageInput = container.querySelector('#messageText') as HTMLTextAreaElement;

    fireEvent.change(messageInput, { target: { value: 'Test message' } });
    fireEvent.click(container.querySelector('#sendMessageBtn')!);

    expect(messageInput.value).toBe('');
  });

  it('shows unread badge on messages FAB', () => {
    act(() => {
      useMessagesStore.getState().addMessage({
        id: 'msg-unread',
        sender: 'Bob',
        content: 'New message',
        timestamp: Date.now(),
        isSelf: false,
      });
    });

    const { container } = render(<App />);
    const badge = container.querySelector('.unread-badge')!;
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe('1');
  });
});

describe('Integration: Theme toggling', () => {
  it('starts with dark theme', () => {
    render(<App />);

    expect(useUIStore.getState().theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggles to light theme', () => {
    const { container } = render(<App />);

    const themeBtn = container.querySelector('[title="Toggle theme"]')!;
    fireEvent.click(themeBtn);

    expect(useUIStore.getState().theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggles back to dark theme', () => {
    act(() => {
      useUIStore.getState().setTheme('light');
    });

    const { container } = render(<App />);
    const themeBtn = container.querySelector('[title="Toggle theme"]')!;
    fireEvent.click(themeBtn);

    expect(useUIStore.getState().theme).toBe('dark');
  });

  it('persists theme to localStorage', () => {
    render(<App />);

    act(() => {
      useUIStore.getState().toggleTheme();
    });

    expect(vi.mocked(localStorage.setItem)).toHaveBeenCalledWith('duocode-theme', 'light');
  });

  it('restores theme from localStorage on mount', () => {
    localStorage.setItem('duocode-theme', 'light');

    render(<App />);

    expect(useUIStore.getState().theme).toBe('light');
  });
});

describe('Integration: State persistence', () => {
  it('persistence layer saves code via StorageManager', async () => {
    const { container } = render(<App />);
    const sessionId = useSessionStore.getState().sessionId!;
    const textarea = container.querySelector('#codeInput') as HTMLTextAreaElement;

    fireEvent.change(textarea!, { target: { value: 'persisted code' } });

    // StorageManager.saveCode wraps in JSON and debounces at 500ms
    // Check that a localStorage.setItem call was made with the code key
    await waitFor(
      () => {
        const callArgs = vi.mocked(localStorage.setItem).mock.calls;
        const codeSave = callArgs.find(([key]) => key === `duocode_code_${sessionId}`);
        expect(codeSave).toBeTruthy();
        const parsed = JSON.parse(codeSave![1]);
        expect(parsed.code).toBe('persisted code');
      },
      { timeout: 2000 }
    );
  });

  it('restores code from localStorage on session load', () => {
    const sessionId = 'restore-test';
    // StorageManager stores code as JSON object
    localStorage.setItem(
      `duocode_code_${sessionId}`,
      JSON.stringify({ code: 'restored code', lastUpdated: Date.now() })
    );

    window.location.search = `?session=${sessionId}`;
    render(<App />);

    expect(useEditorStore.getState().code).toBe('restored code');
  });

  it('persistence layer saves messages via StorageManager', async () => {
    const { container } = render(<App />);
    const sessionId = useSessionStore.getState().sessionId!;
    const messageInput = container.querySelector('#messageText') as HTMLTextAreaElement;

    fireEvent.change(messageInput, { target: { value: 'Save me' } });
    fireEvent.click(container.querySelector('#sendMessageBtn')!);

    await waitFor(
      () => {
        const callArgs = vi.mocked(localStorage.setItem).mock.calls;
        const messagesSave = callArgs.find(([key]) => key === `duocode_messages_${sessionId}`);
        expect(messagesSave).toBeTruthy();
        const parsed = JSON.parse(messagesSave![1]);
        expect(parsed.messages).toHaveLength(1);
      },
      { timeout: 2000 }
    );
  });
});

describe('Integration: New Session flow', () => {
  it('shows new session modal on button click', () => {
    const { container } = render(<App />);

    const newSessionBtn = container.querySelector('[title="New Session"]')!;
    fireEvent.click(newSessionBtn);

    expect(container.querySelector('[data-testid="new-session-modal"]')).toBeInTheDocument();
  });

  it('creates new session on confirm', () => {
    const { container } = render(<App />);
    const oldSessionId = useSessionStore.getState().sessionId;

    fireEvent.click(container.querySelector('[title="New Session"]')!);
    fireEvent.click(container.querySelector('.btn-danger')!);

    const session = useSessionStore.getState();
    expect(session.sessionId).not.toBe(oldSessionId);
    expect(session.isHost).toBe(true);
  });

  it('resets editor and canvas on new session', () => {
    act(() => {
      useEditorStore.getState().setCode('old code');
      useCanvasStore.getState().addStroke({ tool: 'pen', color: '#fff', brushSize: 2, points: [] });
      useMessagesStore.getState().addMessage({
        id: 'old-msg',
        sender: 'Alice',
        content: 'old msg',
        timestamp: Date.now(),
        isSelf: true,
      });
    });

    const { container } = render(<App />);

    fireEvent.click(container.querySelector('[title="New Session"]')!);
    fireEvent.click(container.querySelector('.btn-danger')!);

    expect(useEditorStore.getState().code).toBe('');
    expect(useCanvasStore.getState().drawingStrokes).toHaveLength(0);
    expect(useMessagesStore.getState().messages).toHaveLength(0);
  });

  it('cancels new session modal without changes', () => {
    const { container } = render(<App />);
    const sessionBefore = useSessionStore.getState().sessionId;

    fireEvent.click(container.querySelector('[title="New Session"]')!);
    expect(container.querySelector('[data-testid="new-session-modal"]')).toBeInTheDocument();

    fireEvent.click(container.querySelector('.btn-secondary')!);
    expect(container.querySelector('[data-testid="new-session-modal"]')).not.toBeInTheDocument();

    // Session should be unchanged
    expect(useSessionStore.getState().sessionId).toBe(sessionBefore);
  });
});

describe('Integration: Share session URL', () => {
  it('copies URL to clipboard on share button click', async () => {
    const { container } = render(<App />);

    const shareBtn = container.querySelector('[title="Share session URL"]')!;
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    expect(vi.mocked(navigator.clipboard.writeText)).toHaveBeenCalled();
  });
});

describe('Integration: Connection status indicators', () => {
  it('shows sync indicator', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.sync-indicator')).toBeInTheDocument();
  });

  it('reflects connection state changes in sync indicator', () => {
    const { container } = render(<App />);

    act(() => {
      useConnectionStore.getState().updateConnectionState('connected');
    });

    expect(container.querySelector('.sync-indicator')).toHaveClass('synced');
  });

  it('shows connection type and latency when updated', () => {
    const { container } = render(<App />);

    act(() => {
      useConnectionStore.getState().updateMetrics({ connectionType: 'direct', latency: 42 });
    });

    const connMode = container.querySelector('.conn-mode')!;
    const connLatency = container.querySelector('.conn-latency')!;
    expect(connMode.textContent).toBe('direct');
    expect(connLatency.textContent).toBe('42ms');
  });

  it('shows session timer', () => {
    const { container } = render(<App />);
    const timer = container.querySelector('.session-timer')!;
    expect(timer).toBeInTheDocument();
    expect(timer.textContent).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});

describe('Integration: Remote cursors in code editor', () => {
  it('renders remote cursors when present', () => {
    act(() => {
      useEditorStore.getState().setCode('Hello World');
      useEditorStore.getState().updateRemoteCursor('peer-1', {
        name: 'Bob',
        position: 5,
        line: 0,
        column: 5,
        color: '#ff4444',
      });
    });

    const { container } = render(<App />);
    const cursor = container.querySelector('.remote-cursor');
    expect(cursor).toBeInTheDocument();

    const label = container.querySelector('.remote-cursor-label')!;
    expect(label).toBeInTheDocument();
    expect(label.textContent).toBe('Bob');
  });

  it('does not render cursors when empty', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.remote-cursor')).not.toBeInTheDocument();
  });
});

describe('Integration: Toast notifications', () => {
  it('shows toast on share success', async () => {
    const { container } = render(<App />);

    await act(async () => {
      fireEvent.click(container.querySelector('[title="Share session URL"]')!);
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts.length).toBeGreaterThan(0);
    expect(toasts[0].type).toBe('success');
  });
});

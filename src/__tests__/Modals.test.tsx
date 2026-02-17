import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import NameEntryModal from '../components/Modals/NameEntryModal';
import NewSessionModal from '../components/Modals/NewSessionModal';
import { useUIStore } from '../stores/uiStore';
import { useSessionStore } from '../stores/sessionStore';
import { useEditorStore } from '../stores/editorStore';
import { useMessagesStore } from '../stores/messagesStore';
import { useCanvasStore } from '../stores/canvasStore';
import { useConnectionStore } from '../stores/connectionStore';

describe('NameEntryModal', () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    useSessionStore.getState().reset();
  });

  it('does not render when closed', () => {
    const { container } = render(<NameEntryModal />);
    expect(container.querySelector('[data-testid="name-entry-modal"]')).not.toBeInTheDocument();
  });

  it('renders when open', () => {
    act(() => {
      useUIStore.getState().showNameModal();
    });

    const { container } = render(<NameEntryModal />);
    expect(container.querySelector('[data-testid="name-entry-modal"]')).toBeInTheDocument();
    expect(container.querySelector('h2')!.textContent).toBe('Join Session');
  });

  it('pre-fills name from session store', () => {
    act(() => {
      useSessionStore.getState().setPeerName('Alice');
      useUIStore.getState().showNameModal();
    });

    const { container } = render(<NameEntryModal />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input.value).toBe('Alice');
  });

  it('shows validation error for empty name on Enter', () => {
    act(() => {
      useUIStore.getState().showNameModal();
    });

    const { container } = render(<NameEntryModal />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;

    // Whitespace-only name, submit via Enter (button is disabled)
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(container.querySelector('.error-message')!.textContent).toBe('Please enter your name');
  });

  it('disables join button when name is empty', () => {
    act(() => {
      useUIStore.getState().showNameModal();
    });

    const { container } = render(<NameEntryModal />);
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('saves name and closes modal on submit', () => {
    act(() => {
      useUIStore.getState().showNameModal();
    });

    const { container } = render(<NameEntryModal />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Bob' } });
    fireEvent.click(container.querySelector('button')!);

    expect(useSessionStore.getState().peerName).toBe('Bob');
    expect(useUIStore.getState().isNameModalOpen).toBe(false);
  });

  it('trims whitespace from name', () => {
    act(() => {
      useUIStore.getState().showNameModal();
    });

    const { container } = render(<NameEntryModal />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '  Charlie  ' } });
    fireEvent.click(container.querySelector('button')!);

    expect(useSessionStore.getState().peerName).toBe('Charlie');
  });

  it('submits on Enter key', () => {
    act(() => {
      useUIStore.getState().showNameModal();
    });

    const { container } = render(<NameEntryModal />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Dave' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useSessionStore.getState().peerName).toBe('Dave');
    expect(useUIStore.getState().isNameModalOpen).toBe(false);
  });

  it('clears error when typing', () => {
    act(() => {
      useUIStore.getState().showNameModal();
    });

    const { container } = render(<NameEntryModal />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;

    // Trigger error via Enter (button is disabled for empty name)
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(container.querySelector('.error-message')!.textContent).toBe('Please enter your name');

    // Type to clear error
    fireEvent.change(input, { target: { value: 'Eve' } });
    expect(container.querySelector('.error-message')!.textContent).toBe('');
  });
});

describe('NewSessionModal', () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    useSessionStore.getState().reset();
    useEditorStore.getState().reset();
    useMessagesStore.getState().reset();
    useCanvasStore.getState().reset();
    useConnectionStore.getState().reset();
  });

  it('does not render when closed', () => {
    const { container } = render(<NewSessionModal />);
    expect(container.querySelector('[data-testid="new-session-modal"]')).not.toBeInTheDocument();
  });

  it('renders when open', () => {
    act(() => {
      useUIStore.getState().showNewSessionModal();
    });

    const { container } = render(<NewSessionModal />);
    expect(container.querySelector('[data-testid="new-session-modal"]')).toBeInTheDocument();
    expect(container.querySelector('h2')!.textContent).toBe('New Session');
  });

  it('closes on Cancel click', () => {
    act(() => {
      useUIStore.getState().showNewSessionModal();
    });

    const { container } = render(<NewSessionModal />);
    fireEvent.click(container.querySelector('.btn-secondary')!);

    expect(useUIStore.getState().isNewSessionModalOpen).toBe(false);
  });

  it('resets all stores and creates new session on confirm', () => {
    // Set up some state to verify it gets cleared
    act(() => {
      useSessionStore.getState().createSession('old-session');
      useSessionStore.getState().setPeerName('Alice');
      useEditorStore.getState().setCode('const x = 1;');
      useMessagesStore.getState().addMessage({
        id: 'msg-1',
        sender: 'Alice',
        content: 'Hello',
        timestamp: Date.now(),
        isSelf: true,
      });
      useUIStore.getState().showNewSessionModal();
    });

    const { container } = render(<NewSessionModal />);
    fireEvent.click(container.querySelector('.btn-danger')!);

    // Verify stores were reset
    expect(useEditorStore.getState().code).toBe('');
    expect(useMessagesStore.getState().messages).toHaveLength(0);

    // Verify new session was created
    const session = useSessionStore.getState();
    expect(session.sessionId).toBeTruthy();
    expect(session.sessionId).not.toBe('old-session');
    expect(session.isHost).toBe(true);

    // Modal should be closed
    expect(useUIStore.getState().isNewSessionModalOpen).toBe(false);
  });

  it('shows warning about data loss', () => {
    act(() => {
      useUIStore.getState().showNewSessionModal();
    });

    const { container } = render(<NewSessionModal />);
    const subtitle = container.querySelector('.modal-subtitle')!;
    expect(subtitle.textContent).toContain('data');
    expect(subtitle.textContent).toContain('lost');
  });
});

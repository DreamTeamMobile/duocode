import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import MessageInput from '../components/Messages/MessageInput';
import MessagesList from '../components/Messages/MessagesList';
import MessagesFAB from '../components/Messages/MessagesFAB';
import MessagesPanel from '../components/Messages/MessagesPanel';
import ParticipantsList from '../components/Messages/ParticipantsList';
import { useMessagesStore } from '../stores/messagesStore';
import { useSessionStore } from '../stores/sessionStore';

describe('MessageInput', () => {
  beforeEach(() => {
    useMessagesStore.getState().reset();
    useSessionStore.getState().reset();
  });

  it('renders textarea and send button', () => {
    const { container } = render(<MessageInput />);
    expect(container.querySelector('#messageText')).toBeInTheDocument();
    expect(container.querySelector('#sendMessageBtn')).toBeInTheDocument();
  });

  it('sends a message on button click', () => {
    const { container } = render(<MessageInput />);
    const textarea = container.querySelector('#messageText') as HTMLTextAreaElement;
    const sendBtn = container.querySelector('#sendMessageBtn')!;

    fireEvent.change(textarea, { target: { value: 'Hello world' } });
    fireEvent.click(sendBtn);

    const messages = useMessagesStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello world');
    expect(messages[0].isSelf).toBe(true);
  });

  it('sends a message on Enter key', () => {
    const { container } = render(<MessageInput />);
    const textarea = container.querySelector('#messageText') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'Enter test' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    const messages = useMessagesStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Enter test');
  });

  it('does not send on Shift+Enter', () => {
    const { container } = render(<MessageInput />);
    const textarea = container.querySelector('#messageText') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'Multiline' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(useMessagesStore.getState().messages).toHaveLength(0);
  });

  it('does not send empty messages', () => {
    const { container } = render(<MessageInput />);
    const sendBtn = container.querySelector('#sendMessageBtn')!;

    fireEvent.click(sendBtn);

    expect(useMessagesStore.getState().messages).toHaveLength(0);
  });

  it('clears input after sending', () => {
    const { container } = render(<MessageInput />);
    const textarea = container.querySelector('#messageText') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'Clear test' } });
    fireEvent.click(container.querySelector('#sendMessageBtn')!);

    expect(textarea.value).toBe('');
  });

  it('uses peer name as sender', () => {
    act(() => {
      useSessionStore.getState().setPeerName('Alice');
    });

    const { container } = render(<MessageInput />);
    const textarea = container.querySelector('#messageText') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'Named msg' } });
    fireEvent.click(container.querySelector('#sendMessageBtn')!);

    expect(useMessagesStore.getState().messages[0].sender).toBe('Alice');
  });
});

describe('MessagesList', () => {
  beforeEach(() => {
    useMessagesStore.getState().reset();
  });

  it('shows empty state when no messages', () => {
    const { container } = render(<MessagesList />);
    expect(container.querySelector('.messages-empty')).toBeInTheDocument();
  });

  it('renders messages from store', () => {
    act(() => {
      useMessagesStore.getState().addMessage({
        id: 'msg-1',
        sender: 'Alice',
        content: 'Hello',
        timestamp: Date.now(),
        isSelf: false,
      });
      useMessagesStore.getState().addMessage({
        id: 'msg-2',
        sender: 'You',
        content: 'Hi there',
        timestamp: Date.now(),
        isSelf: true,
        acknowledged: false,
      });
    });

    const { container } = render(<MessagesList />);
    const messages = container.querySelectorAll('.message');
    expect(messages).toHaveLength(2);
    expect(messages[0]).toHaveClass('message-other');
    expect(messages[1]).toHaveClass('message-self');
  });

  it('shows sent/delivered indicators for own messages', () => {
    act(() => {
      useMessagesStore.getState().addMessage({
        id: 'msg-1',
        sender: 'You',
        content: 'Test',
        timestamp: Date.now(),
        isSelf: true,
        acknowledged: false,
      });
    });

    const { container } = render(<MessagesList />);
    const statusEl = container.querySelector('.message-status')!;
    expect(statusEl).toBeInTheDocument();
    expect(statusEl.getAttribute('title')).toBe('Sent');
  });

  it('shows delivered status for acknowledged messages', () => {
    act(() => {
      useMessagesStore.getState().addMessage({
        id: 'msg-ack',
        sender: 'You',
        content: 'Delivered test',
        timestamp: Date.now(),
        isSelf: true,
        acknowledged: true,
      });
    });

    const { container } = render(<MessagesList />);
    const statusEl = container.querySelector('.message-status')!;
    expect(statusEl.getAttribute('title')).toBe('Delivered');
  });
});

describe('MessagesFAB', () => {
  beforeEach(() => {
    useMessagesStore.getState().reset();
  });

  it('renders without unread badge initially', () => {
    const { container } = render(<MessagesFAB />);
    expect(container.querySelector('.messages-fab')).toBeInTheDocument();
    expect(container.querySelector('.unread-badge')).not.toBeInTheDocument();
  });

  it('shows unread badge when messages are unread', () => {
    act(() => {
      useMessagesStore.getState().addMessage({
        id: 'msg-unread',
        sender: 'Bob',
        content: 'Hey',
        timestamp: Date.now(),
        isSelf: false,
      });
    });

    const { container } = render(<MessagesFAB />);
    const badge = container.querySelector('.unread-badge')!;
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe('1');
  });

  it('updates badge count with multiple unread messages', () => {
    act(() => {
      for (let i = 0; i < 3; i++) {
        useMessagesStore.getState().addMessage({
          id: `msg-${i}`,
          sender: 'Bob',
          content: `Msg ${i}`,
          timestamp: Date.now(),
          isSelf: false,
        });
      }
    });

    const { container } = render(<MessagesFAB />);
    expect(container.querySelector('.unread-badge')!.textContent).toBe('3');
  });

  it('toggles panel on click', () => {
    const { container } = render(<MessagesFAB />);
    fireEvent.click(container.querySelector('.messages-fab')!);

    expect(useMessagesStore.getState().isPanelOpen).toBe(true);
  });

  it('clears unread count when panel opens', () => {
    act(() => {
      useMessagesStore.getState().addMessage({
        id: 'msg-clear',
        sender: 'Bob',
        content: 'Clear me',
        timestamp: Date.now(),
        isSelf: false,
      });
    });

    expect(useMessagesStore.getState().unreadCount).toBe(1);

    act(() => {
      useMessagesStore.getState().togglePanel();
    });

    expect(useMessagesStore.getState().unreadCount).toBe(0);
  });
});

describe('MessagesPanel', () => {
  beforeEach(() => {
    useMessagesStore.getState().reset();
  });

  it('renders with collapsed class when panel is closed', () => {
    const { container } = render(<MessagesPanel />);
    const panel = container.querySelector('.messages-panel');
    expect(panel).toHaveClass('collapsed');
  });

  it('removes collapsed class when panel is open', () => {
    act(() => {
      useMessagesStore.getState().togglePanel();
    });

    const { container } = render(<MessagesPanel />);
    const panel = container.querySelector('.messages-panel');
    expect(panel).not.toHaveClass('collapsed');
  });

  it('closes panel when close button is clicked', () => {
    act(() => {
      useMessagesStore.getState().togglePanel(); // open
    });

    const { container } = render(<MessagesPanel />);
    fireEvent.click(container.querySelector('.close-messages-btn')!);

    expect(useMessagesStore.getState().isPanelOpen).toBe(false);
  });
});

describe('ParticipantsList', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    useMessagesStore.getState().reset();
  });

  it('renders local participant', () => {
    act(() => {
      useSessionStore.getState().setPeerName('Alice');
    });

    const { container } = render(<ParticipantsList />);
    const items = container.querySelectorAll('.participant-item');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('Alice');
    expect(items[0].textContent).toContain('(you)');
  });

  it('renders remote participants', () => {
    act(() => {
      useSessionStore.getState().setPeerName('Alice');
      useSessionStore.getState().updateParticipant('peer-1', {
        name: 'Bob',
        isHost: false,
      });
      useSessionStore.getState().updateParticipant('peer-2', {
        name: 'Charlie',
        isHost: false,
      });
    });

    const { container } = render(<ParticipantsList />);
    const items = container.querySelectorAll('.participant-item');
    expect(items).toHaveLength(3);
  });

  it('shows host badge for host participant', () => {
    act(() => {
      useSessionStore.getState().createSession('test-session');
      useSessionStore.getState().setPeerName('Host User');
    });

    const { container } = render(<ParticipantsList />);
    expect(container.querySelector('.host-badge')).toBeInTheDocument();
  });

  it('shows participant count in header', () => {
    act(() => {
      useSessionStore.getState().setPeerName('Alice');
      useSessionStore.getState().updateParticipant('peer-1', {
        name: 'Bob',
        isHost: false,
      });
    });

    const { container } = render(<ParticipantsList />);
    const header = container.querySelector('.participants-header')!;
    expect(header.textContent).toContain('Participants (2)');
  });

  it('collapses on header click', () => {
    const { container } = render(<ParticipantsList />);
    const header = container.querySelector('.participants-header')!;

    fireEvent.click(header);

    expect(container.querySelector('.participants-section')).toHaveClass('collapsed');
  });

  it('allows inline name editing for self', () => {
    act(() => {
      useSessionStore.getState().setPeerName('Alice');
    });

    const { container } = render(<ParticipantsList />);
    const editBtn = container.querySelector('.edit-name-btn')!;
    fireEvent.click(editBtn);

    const input = container.querySelector('.name-edit-input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('Alice');

    fireEvent.change(input, { target: { value: 'Alice B' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useSessionStore.getState().peerName).toBe('Alice B');
  });
});

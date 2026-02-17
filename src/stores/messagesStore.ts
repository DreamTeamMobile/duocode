import { create } from 'zustand';

export interface Message {
  id: string;
  text?: string;
  content?: string;
  sender: string;
  timestamp: number;
  acknowledged?: boolean;
  isSelf?: boolean;
  [key: string]: unknown;
}

interface MessagesState {
  messages: Message[];
  unreadCount: number;
  isPanelOpen: boolean;
  /** Injected by useMessageSync — broadcasts a chat message over WebRTC. */
  _sendChatFn: ((text: string) => string) | null;
}

interface MessagesActions {
  addMessage: (message: Message) => void;
  markAsRead: () => void;
  togglePanel: () => void;
  acknowledgeMessage: (messageId: string) => void;
  setSendChatFn: (fn: ((text: string) => string) | null) => void;
  reset: () => void;
}

export type MessagesStore = MessagesState & MessagesActions;

const isDesktop =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(min-width: 769px)').matches;

const initialState: MessagesState = {
  messages: [],
  unreadCount: 0,
  isPanelOpen: isDesktop,
  _sendChatFn: null,
};

export const useMessagesStore = create<MessagesStore>((set) => ({
  ...initialState,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
      unreadCount: state.isPanelOpen
        ? state.unreadCount
        : state.unreadCount + 1,
    })),

  markAsRead: () => set({ unreadCount: 0 }),

  togglePanel: () =>
    set((state) => ({
      isPanelOpen: !state.isPanelOpen,
      unreadCount: !state.isPanelOpen ? 0 : state.unreadCount,
    })),

  acknowledgeMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, acknowledged: true } : msg
      ),
    })),

  setSendChatFn: (fn) => set({ _sendChatFn: fn }),

  reset: () => set(initialState),
}));

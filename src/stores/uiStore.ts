import { create } from 'zustand';

export type TabName = string;
export type Theme = 'dark' | 'light';

interface UIState {
  activeTab: TabName;
  theme: Theme;
  isNameModalOpen: boolean;
  isNewSessionModalOpen: boolean;
}

interface UIActions {
  switchTab: (tabName: TabName) => void;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  showNameModal: () => void;
  hideNameModal: () => void;
  showNewSessionModal: () => void;
  hideNewSessionModal: () => void;
  reset: () => void;
}

export type UIStore = UIState & UIActions;

const initialState: UIState = {
  activeTab: 'code',
  theme: 'dark',
  isNameModalOpen: false,
  isNewSessionModalOpen: false,
};

export const useUIStore = create<UIStore>((set) => ({
  ...initialState,

  switchTab: (activeTab) => set({ activeTab }),

  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === 'dark' ? 'light' : 'dark',
    })),

  setTheme: (theme) => set({ theme }),

  showNameModal: () => set({ isNameModalOpen: true }),

  hideNameModal: () => set({ isNameModalOpen: false }),

  showNewSessionModal: () => set({ isNewSessionModalOpen: true }),

  hideNewSessionModal: () => set({ isNewSessionModalOpen: false }),

  reset: () => set(initialState),
}));

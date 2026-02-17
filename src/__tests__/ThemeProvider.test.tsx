import { render, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ThemeProvider from '../components/ThemeProvider';
import { useUIStore } from '../stores/uiStore';

describe('ThemeProvider', () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders children', () => {
    const { getByText } = render(
      <ThemeProvider><span>child</span></ThemeProvider>
    );
    expect(getByText('child')).toBeInTheDocument();
  });

  it('applies dark theme to html element by default', () => {
    render(<ThemeProvider><span>test</span></ThemeProvider>);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('persists theme to localStorage', () => {
    render(<ThemeProvider><span>test</span></ThemeProvider>);
    expect(vi.mocked(localStorage.setItem)).toHaveBeenCalledWith('duocode-theme', 'dark');
  });

  it('loads saved theme from localStorage on mount', () => {
    vi.mocked(localStorage.getItem).mockReturnValueOnce('light');
    render(<ThemeProvider><span>test</span></ThemeProvider>);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('updates html attribute when theme changes in store', () => {
    render(<ThemeProvider><span>test</span></ThemeProvider>);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    act(() => {
      useUIStore.getState().toggleTheme();
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

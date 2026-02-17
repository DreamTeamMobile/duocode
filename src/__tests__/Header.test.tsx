import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import Header from '../components/Header';
import { useUIStore } from '../stores/uiStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useSessionStore } from '../stores/sessionStore';

describe('Header', () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    useConnectionStore.getState().reset();
    useSessionStore.getState().reset();
  });

  it('renders app title', () => {
    const { getByText } = render(<Header />);
    expect(getByText('DuoCode')).toBeInTheDocument();
  });

  it('renders version badge', () => {
    const { getByText } = render(<Header />);
    expect(getByText(/^v\d+\.\d+/)).toBeInTheDocument();
  });

  it('renders sync indicator with offline status when disconnected', () => {
    const { container } = render(<Header />);
    const indicator = container.querySelector('.sync-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass('offline');
  });

  it('renders synced indicator when connected', () => {
    act(() => {
      useConnectionStore.getState().updateConnectionState('connected');
    });
    const { container } = render(<Header />);
    const indicator = container.querySelector('.sync-indicator');
    expect(indicator).toHaveClass('synced');
  });

  it('renders session timer with 00:00:00 when no session', () => {
    const { getByText } = render(<Header />);
    expect(getByText('00:00:00')).toBeInTheDocument();
  });

  it('renders connection status indicator', () => {
    const { container } = render(<Header />);
    const connStatus = container.querySelector('.connection-status');
    expect(connStatus).toBeInTheDocument();
  });

  it('shows connection type and latency when available', () => {
    act(() => {
      useConnectionStore.getState().updateMetrics({
        connectionType: 'direct',
        latency: 42,
      });
    });
    const { getByText } = render(<Header />);
    expect(getByText('direct')).toBeInTheDocument();
    expect(getByText('42ms')).toBeInTheDocument();
  });

  it('classifies latency correctly', () => {
    act(() => {
      useConnectionStore.getState().updateMetrics({ latency: 350 });
    });
    const { container } = render(<Header />);
    const latencyEl = container.querySelector('.conn-latency');
    expect(latencyEl).toHaveClass('high');
  });

  it('renders all action buttons', () => {
    const { container } = render(<Header />);
    const buttons = container.querySelectorAll('.icon-btn');
    expect(buttons).toHaveLength(4);
  });

  it('toggles theme when theme button is clicked', () => {
    const { container } = render(<Header />);
    const themeBtn = container.querySelector('[title="Toggle theme"]')!;
    expect(useUIStore.getState().theme).toBe('dark');
    fireEvent.click(themeBtn);
    expect(useUIStore.getState().theme).toBe('light');
  });
});

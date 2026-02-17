import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ToastContainer from '../components/Notifications/ToastContainer';
import RetryBanner from '../components/Notifications/RetryBanner';
import { useToastStore } from '../stores/toastStore';
import { useConnectionStore } from '../stores/connectionStore';

describe('ToastContainer', () => {
  beforeEach(() => {
    useToastStore.getState().reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders empty container with no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.querySelector('[data-testid="toast-container"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="toast"]')).toHaveLength(0);
  });

  it('renders toasts from store', () => {
    act(() => {
      useToastStore.getState().addToast('Test message', 'info');
    });

    const { container } = render(<ToastContainer />);
    const toasts = container.querySelectorAll('[data-testid="toast"]');
    expect(toasts).toHaveLength(1);
    expect(toasts[0].querySelector('.toast-message')!.textContent).toBe('Test message');
  });

  it('renders different toast types', () => {
    act(() => {
      useToastStore.getState().addToast('Success!', 'success');
      useToastStore.getState().addToast('Error!', 'error');
      useToastStore.getState().addToast('Warning!', 'warning');
      useToastStore.getState().addToast('Info!', 'info');
    });

    const { container } = render(<ToastContainer />);
    expect(container.querySelector('.toast-success')).toBeInTheDocument();
    expect(container.querySelector('.toast-error')).toBeInTheDocument();
    expect(container.querySelector('.toast-warning')).toBeInTheDocument();
    expect(container.querySelector('.toast-info')).toBeInTheDocument();
  });

  it('dismisses toast on close button click', () => {
    act(() => {
      useToastStore.getState().addToast('Dismiss me', 'info');
    });

    const { container } = render(<ToastContainer />);
    expect(container.querySelectorAll('[data-testid="toast"]')).toHaveLength(1);

    fireEvent.click(container.querySelector('.toast-close')!);

    expect(container.querySelectorAll('[data-testid="toast"]')).toHaveLength(0);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('auto-dismisses after duration', () => {
    act(() => {
      useToastStore.getState().addToast('Auto dismiss', 'info', { duration: 3000 });
    });

    const { container } = render(<ToastContainer />);
    expect(container.querySelectorAll('[data-testid="toast"]')).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('renders action button and calls callback', () => {
    const actionCallback = vi.fn();

    act(() => {
      useToastStore.getState().addToast('With action', 'info', {
        action: { label: 'Retry', callback: actionCallback },
      });
    });

    const { container } = render(<ToastContainer />);
    const actionBtn = container.querySelector('.toast-action')!;
    expect(actionBtn).toBeInTheDocument();
    expect(actionBtn.textContent).toBe('Retry');

    fireEvent.click(actionBtn);

    expect(actionCallback).toHaveBeenCalled();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('limits toasts to 5', () => {
    act(() => {
      for (let i = 0; i < 7; i++) {
        useToastStore.getState().addToast(`Toast ${i}`, 'info', { duration: 0 });
      }
    });

    expect(useToastStore.getState().toasts).toHaveLength(5);
  });
});

describe('ToastStore convenience methods', () => {
  beforeEach(() => {
    useToastStore.getState().reset();
  });

  it('showSuccess adds success toast', () => {
    act(() => {
      useToastStore.getState().showSuccess('Done!');
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].message).toBe('Done!');
  });

  it('showError adds error toast with longer duration', () => {
    act(() => {
      useToastStore.getState().showError('Failed!');
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('error');
    expect(toasts[0].duration).toBe(8000);
  });

  it('showWarning adds warning toast', () => {
    act(() => {
      useToastStore.getState().showWarning('Careful!');
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('warning');
  });

  it('showInfo adds info toast', () => {
    act(() => {
      useToastStore.getState().showInfo('FYI');
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('info');
  });
});

describe('RetryBanner', () => {
  beforeEach(() => {
    useConnectionStore.getState().reset();
  });

  it('does not render when disconnected', () => {
    const { container } = render(<RetryBanner onCancel={() => {}} onRetry={() => {}} />);
    expect(container.querySelector('[data-testid="retry-banner"]')).not.toBeInTheDocument();
  });

  it('does not render when connected', () => {
    act(() => {
      useConnectionStore.getState().updateConnectionState('connected');
    });

    const { container } = render(<RetryBanner onCancel={() => {}} onRetry={() => {}} />);
    expect(container.querySelector('[data-testid="retry-banner"]')).not.toBeInTheDocument();
  });

  it('renders when reconnecting', () => {
    act(() => {
      useConnectionStore.getState().updateConnectionState('reconnecting');
    });

    const { container } = render(<RetryBanner onCancel={() => {}} onRetry={() => {}} />);
    const banner = container.querySelector('[data-testid="retry-banner"]');
    expect(banner).toBeInTheDocument();
    expect(banner!.querySelector('.retry-message')!.textContent).toBe('Reconnecting...');
  });

  it('shows attempt count when reconnecting', () => {
    act(() => {
      useConnectionStore.getState().updateConnectionState('reconnecting');
      useConnectionStore.setState({
        peerConnections: { 'peer-1': { retryAttempt: 3 } as unknown as string },
      });
    });

    const { container } = render(<RetryBanner onCancel={() => {}} onRetry={() => {}} />);
    expect(container.querySelector('.retry-attempt')!.textContent).toContain('3');
    expect(container.querySelector('.retry-attempt')!.textContent).toContain('5');
  });

  it('shows cancel button when reconnecting', () => {
    act(() => {
      useConnectionStore.getState().updateConnectionState('reconnecting');
    });

    const { container } = render(<RetryBanner onCancel={() => {}} onRetry={() => {}} />);
    expect(container.querySelector('.retry-cancel-btn')).toBeInTheDocument();
    expect(container.querySelector('.retry-manual-btn')).not.toBeInTheDocument();
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    act(() => {
      useConnectionStore.getState().updateConnectionState('reconnecting');
    });

    const { container } = render(<RetryBanner onCancel={onCancel} onRetry={() => {}} />);
    fireEvent.click(container.querySelector('.retry-cancel-btn')!);

    expect(onCancel).toHaveBeenCalled();
  });

  it('renders in failed state with retry button', () => {
    act(() => {
      useConnectionStore.getState().updateConnectionState('error');
    });

    const { container } = render(<RetryBanner onCancel={() => {}} onRetry={() => {}} />);
    const banner = container.querySelector('[data-testid="retry-banner"]');
    expect(banner).toHaveClass('retry-failed');
    expect(banner!.querySelector('.retry-message')!.textContent).toContain('failed');
    expect(container.querySelector('.retry-manual-btn')).toBeInTheDocument();
    expect(container.querySelector('.retry-cancel-btn')).not.toBeInTheDocument();
  });

  it('calls onRetry when retry button clicked', () => {
    const onRetry = vi.fn();
    act(() => {
      useConnectionStore.getState().updateConnectionState('error');
    });

    const { container } = render(<RetryBanner onCancel={() => {}} onRetry={onRetry} />);
    fireEvent.click(container.querySelector('.retry-manual-btn')!);

    expect(onRetry).toHaveBeenCalled();
  });
});

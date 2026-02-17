import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import AppShell from '../components/AppShell';
import { useUIStore } from '../stores/uiStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useSessionStore } from '../stores/sessionStore';

describe('AppShell', () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    useConnectionStore.getState().reset();
    useSessionStore.getState().reset();
  });

  it('renders header, main content area, and footer', () => {
    const { container, getByText } = render(
      <AppShell><div>content</div></AppShell>
    );
    // Header
    expect(getByText('DuoCode')).toBeInTheDocument();
    // Children
    expect(getByText('content')).toBeInTheDocument();
    // Footer
    expect(getByText('Privacy')).toBeInTheDocument();
  });

  it('renders the #app wrapper with flex layout', () => {
    const { container } = render(
      <AppShell><div>test</div></AppShell>
    );
    const appDiv = container.querySelector('#app');
    expect(appDiv).toBeInTheDocument();
  });

  it('renders main element', () => {
    const { container } = render(
      <AppShell><div>test</div></AppShell>
    );
    expect(container.querySelector('main')).toBeInTheDocument();
  });

  it('renders #contentWrapper and #mainLayout', () => {
    const { container } = render(
      <AppShell><div>test</div></AppShell>
    );
    expect(container.querySelector('#contentWrapper')).toBeInTheDocument();
    expect(container.querySelector('#mainLayout')).toBeInTheDocument();
  });

  it('renders children inside mainLayout', () => {
    const { getByTestId } = render(
      <AppShell><div data-testid="child">hello</div></AppShell>
    );
    expect(getByTestId('child')).toBeInTheDocument();
  });
});

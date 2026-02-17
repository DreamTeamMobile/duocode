import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import TabBar from '../components/TabBar';
import { useUIStore } from '../stores/uiStore';
import { useEditorStore } from '../stores/editorStore';

describe('TabBar', () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    useEditorStore.getState().reset();
  });

  it('renders Code and Diagram tab buttons', () => {
    const { getByText } = render(<TabBar />);
    expect(getByText('Code')).toBeInTheDocument();
    expect(getByText('Diagram')).toBeInTheDocument();
  });

  it('marks Code tab as active by default', () => {
    const { getByText } = render(<TabBar />);
    expect(getByText('Code')).toHaveClass('active');
    expect(getByText('Diagram')).not.toHaveClass('active');
  });

  it('switches to Diagram tab on click', () => {
    const { getByText } = render(<TabBar />);
    fireEvent.click(getByText('Diagram'));
    expect(useUIStore.getState().activeTab).toBe('canvas');
  });

  it('switches back to Code tab on click', () => {
    useUIStore.getState().switchTab('canvas');
    const { getByText } = render(<TabBar />);
    fireEvent.click(getByText('Code'));
    expect(useUIStore.getState().activeTab).toBe('code');
  });

  it('shows language selector when Code tab is active', () => {
    const { container } = render(<TabBar />);
    expect(container.querySelector('#languageSelector')).toBeInTheDocument();
  });

  it('hides language selector when Diagram tab is active', () => {
    useUIStore.getState().switchTab('canvas');
    const { container } = render(<TabBar />);
    expect(container.querySelector('#languageSelector')).not.toBeInTheDocument();
  });
});

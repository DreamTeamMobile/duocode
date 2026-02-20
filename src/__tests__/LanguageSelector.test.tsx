import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import LanguageSelector from '../components/CodeEditor/LanguageSelector';
import { useEditorStore } from '../stores/editorStore';

describe('LanguageSelector', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('renders a select element with javascript selected by default', () => {
    const { container } = render(<LanguageSelector />);
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('javascript');
  });

  it('renders all 16 supported languages', () => {
    const { container } = render(<LanguageSelector />);
    const options = container.querySelectorAll('option');
    expect(options).toHaveLength(16);
  });

  it('displays human-readable labels', () => {
    const { getByText } = render(<LanguageSelector />);
    // Executable languages get a ▶ prefix (JS, TS, Python, C, C++, Go, Ruby, Lua)
    expect(getByText(/JavaScript/)).toBeInTheDocument();
    expect(getByText(/TypeScript/)).toBeInTheDocument();
    expect(getByText(/Python/)).toBeInTheDocument();
    expect(getByText(/C\+\+/)).toBeInTheDocument();
    expect(getByText('C#')).toBeInTheDocument();
  });

  it('changes language in store when a new option is selected', () => {
    const { container } = render(<LanguageSelector />);
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select!, { target: { value: 'python' } });
    expect(useEditorStore.getState().language).toBe('python');
  });
});

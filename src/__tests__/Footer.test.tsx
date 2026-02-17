import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Footer from '../components/Footer';

describe('Footer', () => {
  it('renders Open Source repo link', () => {
    const { getByText } = render(<Footer />);
    const link = getByText('Open Source');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')!.getAttribute('href')).toBe('https://github.com/DreamTeamMobile/duocode');
    expect(link.closest('a')!.getAttribute('target')).toBe('_blank');
  });

  it('renders privacy link', () => {
    const { getByText } = render(<Footer />);
    const link = getByText('Privacy');
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('privacy.html');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('renders terms link', () => {
    const { getByText } = render(<Footer />);
    const link = getByText('Terms');
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('terms.html');
  });

  it('renders copyright with DreamTeam Mobile link', () => {
    const { getByText } = render(<Footer />);
    const link = getByText('DreamTeam Mobile');
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('https://dreamteam-mobile.com');
  });

  it('renders separators', () => {
    const { container } = render(<Footer />);
    const separators = container.querySelectorAll('.footer-separator');
    expect(separators).toHaveLength(3);
  });

  it('has app-footer class', () => {
    const { container } = render(<Footer />);
    expect(container.querySelector('.app-footer')).toBeInTheDocument();
  });
});

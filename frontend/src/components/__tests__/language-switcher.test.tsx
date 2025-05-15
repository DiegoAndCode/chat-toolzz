import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LanguageSwitcher } from '../language-switcher';

// Mock next/navigation
const mockRouterRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRouterRefresh,
  }),
}));

// Helper para simular document.cookie
let mockCookie = '';
Object.defineProperty(document, 'cookie', {
  get: jest.fn(() => mockCookie),
  set: jest.fn((value) => {
    mockCookie = value;
  }),
  configurable: true,
});

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    // Reseta o cookie e o mock do router antes de cada teste
    mockCookie = '';
    mockRouterRefresh.mockClear();
    // Garante que o componente seja remontado para ler o estado inicial do cookie
    // e para que o useEffect de montagem seja executado
  });

  it('renders with default locale (pt) after mount if no cookie', async () => {
    render(<LanguageSwitcher />);
    const button = await screen.findByRole('button', { name: /Português/i });
    expect(button).toBeInTheDocument();
    const img = screen.getByAltText('Português') as HTMLImageElement;
    expect(img.src).toContain('flagcdn.com/w20/br.png');
  });

  it('renders with locale from cookie after mount', async () => {
    mockCookie = 'CHAT_LOCALE=en';
    render(<LanguageSwitcher />);
    const button = await screen.findByRole('button', { name: /English/i });
    expect(button).toBeInTheDocument();
    const img = screen.getByAltText('English') as HTMLImageElement;
    expect(img.src).toContain('flagcdn.com/w20/us.png');
  });

  it('handles invalid cookie by defaulting to pt', async () => {
    mockCookie = 'CHAT_LOCALE=xx'; // Invalid locale
    render(<LanguageSwitcher />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Português/i })).toBeInTheDocument();
    });
    const img = screen.getByAltText('Português') as HTMLImageElement;
    expect(img.src).toContain('flagcdn.com/w20/br.png');
  });
});
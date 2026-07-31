import { create } from 'zustand';

export type Theme = 'dark' | 'light';

const KEY = 'wn.theme';

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

// Stored choice wins; otherwise follow the OS.
function initialTheme(): Theme {
  return readStored() ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  // Keep the mobile browser/PWA status bar in step with the app background.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f7f8fa' : '#0f1115');
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Private mode: theme just resets next launch.
  }
}

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: initialTheme(),
  setTheme: (theme) => {
    apply(theme);
    set({ theme });
  },
  toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}));

// Paint the stored theme immediately, before React mounts, to avoid a flash.
apply(useTheme.getState().theme);

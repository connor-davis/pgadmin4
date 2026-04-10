import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';

// ─── CSS variable keys exposed for customisation ───────────────────────────────

export const THEME_VAR_LABELS: Record<string, string> = {
  '--background': 'Background',
  '--foreground': 'Foreground',
  '--primary': 'Primary',
  '--primary-foreground': 'Primary Foreground',
  '--secondary': 'Secondary',
  '--accent': 'Accent',
  '--muted': 'Muted',
  '--border': 'Border',
  '--ring': 'Ring',
  '--destructive': 'Destructive',
  '--sidebar': 'Sidebar Background',
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PreferencesState {
  /** Custom CSS variable overrides applied on top of the active theme */
  cssVarOverrides: Record<string, string>;
}

type PreferencesAction =
  | { type: 'SET_CSS_VAR'; key: string; value: string }
  | { type: 'RESET_CSS_VARS' }
  | { type: 'LOAD'; state: PreferencesState };

const STORAGE_KEY = 'pgadmin4-prefs';

const defaultState: PreferencesState = {
  cssVarOverrides: {},
};

// ─── Reducer ───────────────────────────────────────────────────────────────────

function reducer(
  state: PreferencesState,
  action: PreferencesAction
): PreferencesState {
  switch (action.type) {
    case 'SET_CSS_VAR':
      return {
        ...state,
        cssVarOverrides: {
          ...state.cssVarOverrides,
          [action.key]: action.value,
        },
      };
    case 'RESET_CSS_VARS':
      return { ...state, cssVarOverrides: {} };
    case 'LOAD':
      return action.state;
    default:
      return state;
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────

interface PreferencesContextValue {
  prefs: PreferencesState;
  setCssVar: (key: string, value: string) => void;
  resetCssVars: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [prefs, dispatch] = useReducer(reducer, defaultState, (init) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...init, ...JSON.parse(stored) };
    } catch {
      // ignore
    }
    return init;
  });

  // Persist whenever prefs change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [prefs]);

  // Apply custom CSS vars to :root
  useEffect(() => {
    const root = document.documentElement;
    // Clear any previously-set overrides then apply current ones
    for (const key of Object.keys(THEME_VAR_LABELS)) {
      root.style.removeProperty(key);
    }
    for (const [key, value] of Object.entries(prefs.cssVarOverrides)) {
      if (value) root.style.setProperty(key, value);
    }
  }, [prefs.cssVarOverrides]);

  const setCssVar = useCallback((key: string, value: string) => {
    dispatch({ type: 'SET_CSS_VAR', key, value });
  }, []);

  const resetCssVars = useCallback(() => {
    dispatch({ type: 'RESET_CSS_VARS' });
  }, []);

  return React.createElement(
    PreferencesContext.Provider,
    { value: { prefs, setCssVar, resetCssVars } },
    children
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx)
    throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}

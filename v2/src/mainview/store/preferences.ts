import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';

export type ThemeVariableDefinition = {
  key: string;
  label: string;
};

export type ThemeVariableSection = {
  id: string;
  category: 'appearance' | 'sidebar';
  label: string;
  description: string;
  variables: ThemeVariableDefinition[];
};

export const THEME_VAR_SECTIONS: ThemeVariableSection[] = [
  {
    id: 'core-colours',
    category: 'appearance',
    label: 'Core Colours',
    description: 'Primary application colours used throughout the main workspace.',
    variables: [
      { key: '--background', label: 'Background' },
      { key: '--foreground', label: 'Foreground' },
      { key: '--primary', label: 'Primary' },
      { key: '--primary-foreground', label: 'Primary Foreground' },
      { key: '--secondary', label: 'Secondary' },
      { key: '--secondary-foreground', label: 'Secondary Foreground' },
      { key: '--accent', label: 'Accent' },
      { key: '--accent-foreground', label: 'Accent Foreground' },
      { key: '--destructive', label: 'Destructive' },
    ],
  },
  {
    id: 'surface-colours',
    category: 'appearance',
    label: 'Surface Colours',
    description: 'Cards, popovers, inputs, muted surfaces, and borders.',
    variables: [
      { key: '--card', label: 'Card Background' },
      { key: '--card-foreground', label: 'Card Foreground' },
      { key: '--popover', label: 'Popover Background' },
      { key: '--popover-foreground', label: 'Popover Foreground' },
      { key: '--muted', label: 'Muted Background' },
      { key: '--muted-foreground', label: 'Muted Foreground' },
      { key: '--border', label: 'Border' },
      { key: '--input', label: 'Input Border' },
      { key: '--ring', label: 'Focus Ring' },
    ],
  },
  {
    id: 'chart-colours',
    category: 'appearance',
    label: 'Chart Colours',
    description: 'Chart palette tokens used by data visualizations.',
    variables: [
      { key: '--chart-1', label: 'Chart 1' },
      { key: '--chart-2', label: 'Chart 2' },
      { key: '--chart-3', label: 'Chart 3' },
      { key: '--chart-4', label: 'Chart 4' },
      { key: '--chart-5', label: 'Chart 5' },
    ],
  },
  {
    id: 'sidebar-colours',
    category: 'sidebar',
    label: 'Sidebar Colours',
    description: 'Object explorer, navigation rails, and settings sidebar tokens.',
    variables: [
      { key: '--sidebar', label: 'Sidebar Background' },
      { key: '--sidebar-foreground', label: 'Sidebar Foreground' },
      { key: '--sidebar-primary', label: 'Sidebar Primary' },
      {
        key: '--sidebar-primary-foreground',
        label: 'Sidebar Primary Foreground',
      },
      { key: '--sidebar-accent', label: 'Sidebar Accent' },
      {
        key: '--sidebar-accent-foreground',
        label: 'Sidebar Accent Foreground',
      },
      { key: '--sidebar-border', label: 'Sidebar Border' },
      { key: '--sidebar-ring', label: 'Sidebar Focus Ring' },
    ],
  },
];

export const THEME_VAR_LABELS = Object.fromEntries(
  THEME_VAR_SECTIONS.flatMap((section) =>
    section.variables.map((variable) => [variable.key, variable.label])
  )
) as Record<string, string>;

export interface PreferencesState {
  cssVarOverrides: Record<string, string>;
}

type PreferencesAction =
  | { type: 'SET_CSS_VAR'; key: string; value: string }
  | { type: 'RESET_CSS_VARS' }
  | { type: 'LOAD'; state: PreferencesState };

const STORAGE_KEY = 'viper-prefs';

const defaultState: PreferencesState = {
  cssVarOverrides: {},
};

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

interface PreferencesContextValue {
  prefs: PreferencesState;
  setCssVar: (key: string, value: string) => void;
  resetCssVars: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [prefs]);

  useEffect(() => {
    const root = document.documentElement;

    for (const key of Object.keys(THEME_VAR_LABELS)) {
      root.style.removeProperty(key);
    }

    for (const [key, value] of Object.entries(prefs.cssVarOverrides)) {
      if (value) {
        root.style.setProperty(key, value);
      }
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

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx)
    throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}

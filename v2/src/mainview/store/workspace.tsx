import React, {
  createContext,
  useCallback,
  useContext,
  useReducer,
} from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TabType = 'erd' | 'query-tool' | 'scratch-pad' | 'welcome';

export interface QueryToolTabData {
  type: 'query-tool';
  serverId: string;
  database: string;
  /** Label shown in the tab bar */
  title: string;
  /** Optional SQL to pre-seed the editor with */
  initialSql?: string;
}

export interface WelcomeTabData {
  type: 'welcome';
  title: string;
}

export interface ScratchPadTabData {
  type: 'scratch-pad';
  title: string;
}

export interface ERDTabData {
  type: 'erd';
  serverId: string;
  database: string;
  schema?: string;
  title: string;
}

export type TabData =
  | ERDTabData
  | QueryToolTabData
  | ScratchPadTabData
  | WelcomeTabData;

export interface WorkspaceTab {
  id: string;
  data: TabData;
}

interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
}

type WorkspaceAction =
  | { type: 'OPEN_TAB'; tab: WorkspaceTab }
  | { type: 'CLOSE_TAB'; id: string }
  | { type: 'ACTIVATE_TAB'; id: string };

// ─── Reducer ───────────────────────────────────────────────────────────────────

function reducer(
  state: WorkspaceState,
  action: WorkspaceAction
): WorkspaceState {
  switch (action.type) {
    case 'OPEN_TAB': {
      if (action.tab.data.type === 'scratch-pad') {
        const existing = state.tabs.find((t) => t.data.type === 'scratch-pad');
        if (existing) {
          return { ...state, activeTabId: existing.id };
        }
      }

      if (action.tab.data.type === 'erd') {
        const newData = action.tab.data as ERDTabData;
        const existing = state.tabs.find((t) => {
          if (t.data.type !== 'erd') return false;
          const existingData = t.data as ERDTabData;
          return (
            existingData.serverId === newData.serverId &&
            existingData.database === newData.database &&
            existingData.schema === newData.schema
          );
        });

        if (existing) {
          return { ...state, activeTabId: existing.id };
        }
      }

      // If a query-tool tab (no initialSql) for same server+db already exists, just activate it
      if (action.tab.data.type === 'query-tool') {
        const newData = action.tab.data as QueryToolTabData;
        if (!newData.initialSql) {
          const existing = state.tabs.find((t) => {
            if (t.data.type !== 'query-tool') return false;
            const tData = t.data as QueryToolTabData;
            return (
              tData.serverId === newData.serverId &&
              tData.database === newData.database &&
              !tData.initialSql
            );
          });
          if (existing) {
            return { ...state, activeTabId: existing.id };
          }
        }
      }
      return {
        tabs: [...state.tabs, action.tab],
        activeTabId: action.tab.id,
      };
    }
    case 'CLOSE_TAB': {
      const idx = state.tabs.findIndex((t) => t.id === action.id);
      const newTabs = state.tabs.filter((t) => t.id !== action.id);
      let newActive = state.activeTabId;
      if (state.activeTabId === action.id) {
        const sibling = newTabs[Math.max(0, idx - 1)];
        newActive = sibling?.id ?? null;
      }
      return { tabs: newTabs, activeTabId: newActive };
    }
    case 'ACTIVATE_TAB':
      return { ...state, activeTabId: action.id };
    default:
      return state;
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────

interface WorkspaceContextValue {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  openERD: (serverId: string, database: string, schema?: string) => void;
  openQueryTool: (serverId: string, database: string) => void;
  openScratchPad: () => void;
  openViewData: (
    serverId: string,
    database: string,
    schema: string,
    table: string
  ) => void;
  openScript: (
    serverId: string,
    database: string,
    title: string,
    sql: string
  ) => void;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    tabs: [],
    activeTabId: null,
  });

  const openERD = useCallback(
    (serverId: string, database: string, schema?: string) => {
      dispatch({
        type: 'OPEN_TAB',
        tab: {
          id: `erd-${serverId}-${database}-${schema ?? '__database__'}`,
          data: {
            type: 'erd',
            serverId,
            database,
            schema,
            title: schema ? `${database}.${schema} ERD` : `${database} ERD`,
          },
        },
      });
    },
    []
  );

  const openQueryTool = useCallback((serverId: string, database: string) => {
    const id = `query-tool-${serverId}-${database}-${Date.now()}`;
    dispatch({
      type: 'OPEN_TAB',
      tab: {
        id,
        data: {
          type: 'query-tool',
          serverId,
          database,
          title: database || 'Query Tool',
        },
      },
    });
  }, []);

  const openScratchPad = useCallback(() => {
    dispatch({
      type: 'OPEN_TAB',
      tab: {
        id: 'scratch-pad',
        data: { type: 'scratch-pad', title: 'Scratch Pad' },
      },
    });
  }, []);

  const openViewData = useCallback(
    (serverId: string, database: string, schema: string, table: string) => {
      const id = `view-data-${serverId}-${database}-${schema}-${table}-${Date.now()}`;
      const initialSql = `SELECT *\nFROM "${schema}"."${table}"\nLIMIT 1000;`;
      dispatch({
        type: 'OPEN_TAB',
        tab: {
          id,
          data: {
            type: 'query-tool',
            serverId,
            database,
            title: `${schema}.${table}`,
            initialSql,
          },
        },
      });
    },
    []
  );

  const openScript = useCallback(
    (serverId: string, database: string, title: string, sql: string) => {
      const id = `script-${serverId}-${database}-${title.replace(/\s+/g, '-')}-${Date.now()}`;
      dispatch({
        type: 'OPEN_TAB',
        tab: {
          id,
          data: {
            type: 'query-tool',
            serverId,
            database,
            title,
            initialSql: sql,
          },
        },
      });
    },
    []
  );

  const closeTab = useCallback((id: string) => {
    dispatch({ type: 'CLOSE_TAB', id });
  }, []);

  const activateTab = useCallback((id: string) => {
    dispatch({ type: 'ACTIVATE_TAB', id });
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        openERD,
        openQueryTool,
        openScratchPad,
        openViewData,
        openScript,
        closeTab,
        activateTab,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx)
    throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}

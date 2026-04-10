import {
  BarChart2,
  Database,
  GitFork,
  Info,
  LayoutGrid,
  List,
  Plus,
  Table2,
} from 'lucide-react';
import { useState } from 'react';

import { AddServerDialog } from '@/components/pgadmin/dialogs/AddServerDialog';
import { PreferencesDialog } from '@/components/pgadmin/dialogs/PreferencesDialog';
import { TitleBar } from '@/components/layout/TitleBar';
import { Workspace } from '@/components/layout/Workspace';
import { ObjectExplorer } from '@/components/pgadmin/ObjectExplorer';
import { cn } from '@/lib/utils';
import { PreferencesProvider } from '@/store/preferences';

// ─── Left icon strip items ────────────────────────────────────────────────────

type SidebarView =
  | 'explorer'
  | 'dashboard'
  | 'properties'
  | 'sql'
  | 'statistics'
  | 'dependencies'
  | 'dependents';

const SIDEBAR_ITEMS: {
  id: SidebarView;
  icon: React.ReactNode;
  label: string;
}[] = [
  {
    id: 'explorer',
    icon: <Database className="h-4 w-4" />,
    label: 'Object Explorer',
  },
  {
    id: 'dashboard',
    icon: <LayoutGrid className="h-4 w-4" />,
    label: 'Dashboard',
  },
  { id: 'properties', icon: <Info className="h-4 w-4" />, label: 'Properties' },
  { id: 'sql', icon: <Table2 className="h-4 w-4" />, label: 'SQL' },
  {
    id: 'statistics',
    icon: <BarChart2 className="h-4 w-4" />,
    label: 'Statistics',
  },
  {
    id: 'dependencies',
    icon: <GitFork className="h-4 w-4" />,
    label: 'Dependencies',
  },
  { id: 'dependents', icon: <List className="h-4 w-4" />, label: 'Dependents' },
];

// ─── AppShell ─────────────────────────────────────────────────────────────────

export function AppShell() {
  const [activeView, setActiveView] = useState<SidebarView>('explorer');
  const [explorerWidth, setExplorerWidth] = useState(260);
  const [dragging, setDragging] = useState(false);
  const [addServerOpen, setAddServerOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    const startWidth = explorerWidth;

    function onMove(ev: MouseEvent) {
      const next = Math.max(
        160,
        Math.min(600, startWidth + ev.clientX - startX)
      );
      setExplorerWidth(next);
    }
    function onUp() {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <PreferencesProvider>
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* Title bar (draggable, combined with menu bar) */}
      <TitleBar
        onOpenPreferences={() => setPrefsOpen(true)}
        onAddServer={() => setAddServerOpen(true)}
      />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Icon-only sidebar strip */}
        <div className="flex w-9 shrink-0 flex-col items-center gap-0.5 border-r border-border bg-sidebar py-1">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.id}
              title={item.label}
              onClick={() => setActiveView(item.id)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
                activeView === item.id &&
                  'bg-sidebar-accent text-sidebar-foreground'
              )}
            >
              {item.icon}
            </button>
          ))}
        </div>

        {/* Object Explorer panel (resizable) */}
        <div
          className="relative flex shrink-0 flex-col border-r border-border bg-sidebar overflow-hidden"
          style={{ width: explorerWidth }}
        >
          {/* Panel header */}
          <div className="flex h-8 shrink-0 items-center border-b border-sidebar-border px-2 text-xs font-medium text-sidebar-foreground uppercase tracking-wide">
            <span className="flex-1 truncate">
              {SIDEBAR_ITEMS.find((i) => i.id === activeView)?.label ??
                'Object Explorer'}
            </span>
            {activeView === 'explorer' && (
              <button
                title="Add Server"
                onClick={() => setAddServerOpen(true)}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-auto p-1">
            {activeView === 'explorer' && (
              <ObjectExplorer onAddServer={() => setAddServerOpen(true)} />
            )}
            {activeView !== 'explorer' && (
              <p className="p-3 text-xs text-muted-foreground">
                {SIDEBAR_ITEMS.find((i) => i.id === activeView)?.label} panel is
                not yet implemented.
              </p>
            )}
          </div>

          {/* Drag handle */}
          <div
            onMouseDown={onDragStart}
            className={cn(
              'absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/40',
              dragging && 'bg-primary/60'
            )}
          />
        </div>

        {/* Main workspace */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Workspace />
        </div>
      </div>

      <AddServerDialog open={addServerOpen} onOpenChange={setAddServerOpen} />
      <PreferencesDialog open={prefsOpen} onOpenChange={setPrefsOpen} />
    </div>
    </PreferencesProvider>
  );
}

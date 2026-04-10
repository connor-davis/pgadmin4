import { Outlet } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Database } from 'lucide-react';
import { useState } from 'react';

import { ObjectExplorer } from '@/components/pgadmin/ObjectExplorer';
import { cn } from '@/lib/utils';

interface AppShellProps {
  className?: string;
}

export function AppShell({ className }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div
      className={cn(
        'flex h-screen w-screen overflow-hidden bg-background',
        className
      )}
    >
      {/* Sidebar — Object Explorer */}
      <aside
        className={cn(
          'relative flex flex-col border-r border-border bg-sidebar transition-all duration-200 shrink-0',
          sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-72'
        )}
      >
        {/* Sidebar header */}
        <div className="flex h-10 items-center gap-2 border-b border-sidebar-border px-3">
          <Database className="h-4 w-4 text-sidebar-primary shrink-0" />
          <span className="text-sm font-medium text-sidebar-foreground truncate">
            Object Explorer
          </span>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-auto p-1">
          <ObjectExplorer />
        </div>
      </aside>

      {/* Sidebar toggle */}
      <button
        onClick={() => setSidebarCollapsed((c) => !c)}
        className={cn(
          'absolute z-10 top-1/2 -translate-y-1/2 flex h-6 w-3 items-center justify-center',
          'bg-border hover:bg-muted-foreground/20 rounded-r transition-colors',
          sidebarCollapsed ? 'left-0' : 'left-72'
        )}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronLeft className="h-3 w-3 text-muted-foreground" />
        )}
      </button>

      {/* Main content area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-10 items-center border-b border-border bg-background px-4">
          <span className="text-sm font-semibold text-foreground">
            pgAdmin 4
          </span>
        </header>

        {/* Router outlet — fills remaining space */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

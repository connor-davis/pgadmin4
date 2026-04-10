import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useWorkspace } from '@/store/workspace';

export function TabBar() {
  const { tabs, activeTabId, activateTab, closeTab } = useWorkspace();

  if (tabs.length === 0) return null;

  return (
    <div className="flex h-8 shrink-0 items-end overflow-x-auto border-b border-border bg-muted/30 px-1 gap-0.5">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => activateTab(tab.id)}
            className={cn(
              'group relative flex h-7 min-w-0 max-w-48 shrink-0 cursor-pointer items-center gap-1.5 rounded-t border border-b-0 px-3 text-xs transition-colors',
              isActive
                ? 'border-border bg-background text-foreground'
                : 'border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground'
            )}
          >
            <span className="truncate">{tab.data.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="ml-auto flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded opacity-0 hover:bg-muted-foreground/20 group-hover:opacity-100"
              aria-label={`Close ${tab.data.title}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

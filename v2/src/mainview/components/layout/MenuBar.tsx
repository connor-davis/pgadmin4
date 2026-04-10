import { useState } from 'react';

import { AddServerDialog } from '@/components/pgadmin/dialogs/AddServerDialog';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/store/workspace';

interface MenuItem {
  label: string;
  shortcut?: string;
  separator?: false;
  disabled?: boolean;
  onClick?: () => void;
}

interface MenuSeparator {
  separator: true;
}

type MenuEntry = MenuItem | MenuSeparator;

interface Menu {
  label: string;
  items: MenuEntry[];
}

function isSeparator(item: MenuEntry): item is MenuSeparator {
  return (item as MenuSeparator).separator === true;
}

function DropdownMenu({ menu, onClose }: { menu: Menu; onClose: () => void }) {
  return (
    <div
      className="absolute top-full left-0 z-50 min-w-44 border border-border bg-popover py-1 shadow-md text-sm"
      onMouseLeave={onClose}
    >
      {menu.items.map((item, i) => {
        if (isSeparator(item)) {
          return <div key={i} className="my-1 border-t border-border" />;
        }
        return (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
            className={cn(
              'flex w-full items-center justify-between px-4 py-0.5 text-left',
              item.disabled
                ? 'text-muted-foreground cursor-default'
                : 'hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="ml-8 text-xs text-muted-foreground">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function MenuBar() {
  const [open, setOpen] = useState<string | null>(null);
  const [addServerOpen, setAddServerOpen] = useState(false);
  const { openQueryTool } = useWorkspace();

  const menus: Menu[] = [
    {
      label: 'File',
      items: [
        { label: 'Add Server...', onClick: () => setAddServerOpen(true) },
        { separator: true },
        { label: 'Preferences', onClick: () => {} },
        { separator: true },
        { label: 'Reset Layout', onClick: () => {} },
        { separator: true },
        { label: 'Quit pgAdmin 4', shortcut: 'Alt+F4', onClick: () => {} },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Search objects...', shortcut: 'Ctrl+F', onClick: () => {} },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Object Explorer', onClick: () => {} },
        { label: 'Query Tool', onClick: () => {} },
        { separator: true },
        { label: 'Refresh', shortcut: 'F5', onClick: () => {} },
      ],
    },
    {
      label: 'Tools',
      items: [
        {
          label: 'Query Tool',
          shortcut: 'Alt+Shift+Q',
          onClick: () => openQueryTool('', ''),
        },
        { label: 'PSQL Tool', disabled: true },
        { label: 'Schema Diff', disabled: true },
        { separator: true },
        { label: 'ERD for database', disabled: true },
        { separator: true },
        { label: 'Import/Export Data', disabled: true },
        { label: 'Backup...', disabled: true },
        { label: 'Restore...', disabled: true },
        { label: 'Grant Wizard', disabled: true },
        { separator: true },
        { label: 'Maintenance...', disabled: true },
        { label: 'Server Status', disabled: true },
      ],
    },
    {
      label: 'Window',
      items: [{ label: 'pgAdmin 4', onClick: () => {} }],
    },
    {
      label: 'Help',
      items: [
        { label: 'Quick Search', shortcut: 'Ctrl+/', disabled: true },
        { separator: true },
        { label: 'Online Help', disabled: true },
        { label: 'pgAdmin Website', disabled: true },
        { label: 'PostgreSQL Website', disabled: true },
        { separator: true },
        { label: 'About pgAdmin 4', onClick: () => {} },
      ],
    },
  ];

  return (
    <div className="flex h-7 shrink-0 items-stretch border-b border-border bg-background text-sm select-none">
      {menus.map((menu) => (
        <div key={menu.label} className="relative">
          <button
            onMouseDown={() => setOpen(open === menu.label ? null : menu.label)}
            onMouseEnter={() => open !== null && setOpen(menu.label)}
            className={cn(
              'h-full px-3 text-foreground',
              open === menu.label
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/60'
            )}
          >
            {menu.label}
          </button>
          {open === menu.label && (
            <DropdownMenu menu={menu} onClose={() => setOpen(null)} />
          )}
        </div>
      ))}
      {/* Backdrop to close menus when clicking elsewhere */}
      {open && (
        <div className="fixed inset-0 z-40" onMouseDown={() => setOpen(null)} />
      )}
      <AddServerDialog open={addServerOpen} onOpenChange={setAddServerOpen} />
    </div>
  );
}

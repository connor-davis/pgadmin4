import { Maximize2, Minus, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PgAdminIcon } from '@/components/icons/PgAdminIcon';
import { AddServerDialog } from '@/components/pgadmin/dialogs/AddServerDialog';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from '@/components/ui/menubar';
import { rpc } from '@/lib/rpc';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/store/workspace';

interface TitleBarProps {
  onOpenPreferences?: () => void;
  onAddServer?: () => void;
}

export function TitleBar({ onOpenPreferences, onAddServer }: TitleBarProps) {
  const [addServerOpen, setAddServerOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const { openQueryTool } = useWorkspace();

  useEffect(() => {
    rpc.getWindowState().then((state) => {
      setIsMaximized(state.maximized);
    });
  }, []);

  async function handleMinimize() {
    await rpc.minimizeWindow();
  }

  async function handleMaximize() {
    await rpc.maximizeWindow();
    const state = await rpc.getWindowState();
    setIsMaximized(state?.maximized ?? false);
  }

  async function handleClose() {
    await rpc.closeWindow();
  }

  type MenuEntry =
    | { separator: true }
    | {
        separator?: false;
        label: string;
        shortcut?: string;
        disabled?: boolean;
        onClick?: () => void;
      };

  const menus: { label: string; items: MenuEntry[] }[] = [
    {
      label: 'File',
      items: [
        {
          label: 'Add Server...',
          onClick: () => {
            onAddServer?.();
            setAddServerOpen(true);
          },
        },
        { separator: true },
        { label: 'Preferences', onClick: () => onOpenPreferences?.() },
        { separator: true },
        { label: 'Reset Layout', onClick: () => {} },
        { separator: true },
        {
          label: 'Quit pgAdmin 4',
          shortcut: 'Alt+F4',
          onClick: () => handleClose(),
        },
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
    <>
      {/* electrobun-webkit-app-region-drag makes the whole bar draggable */}
      <div className="electrobun-webkit-app-region-drag flex h-8 shrink-0 items-stretch border-b border-border bg-background select-none">
        {/* App identity — no-drag so text is selectable and clicks don't drag */}
        <div className="electrobun-webkit-app-region-no-drag flex shrink-0 items-center gap-1.5 pl-3 pr-2">
          <PgAdminIcon className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            pgAdmin 4
          </span>
        </div>

        {/* Menu items — no-drag so they remain clickable */}
        <div className="electrobun-webkit-app-region-no-drag flex items-stretch">
          <Menubar className="h-full gap-0 rounded-none border-0 bg-transparent p-0 shadow-none">
            {menus.map((menu) => (
              <MenubarMenu key={menu.label}>
                <MenubarTrigger className="h-full rounded-none px-3 text-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground hover:bg-accent/60">
                  {menu.label}
                </MenubarTrigger>
                <MenubarContent
                  align="start"
                  sideOffset={0}
                  alignOffset={0}
                  className="w-auto max-w-none "
                >
                  {menu.items.map((item, i) => {
                    if ('separator' in item && item.separator) {
                      return <MenubarSeparator key={i} />;
                    }
                    const it = item as Exclude<MenuEntry, { separator: true }>;
                    return (
                      <MenubarItem
                        key={i}
                        disabled={it.disabled}
                        onClick={() => it.onClick?.()}
                      >
                        {it.label}
                        {it.shortcut && (
                          <MenubarShortcut>
                            <KbdGroup>
                              {it.shortcut.split('+').map((key) => (
                                <Kbd key={key}>{key}</Kbd>
                              ))}
                            </KbdGroup>
                          </MenubarShortcut>
                        )}
                      </MenubarItem>
                    );
                  })}
                </MenubarContent>
              </MenubarMenu>
            ))}
          </Menubar>
        </div>

        {/* Flexible drag area fills the remaining space */}
        <div className="flex-1" />

        {/* Window controls — no-drag so clicks register */}
        <div className="electrobun-webkit-app-region-no-drag flex shrink-0 items-stretch">
          <button
            title="Minimize"
            onClick={handleMinimize}
            className="flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            title={isMaximized ? 'Restore' : 'Maximize'}
            onClick={handleMaximize}
            className="flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {isMaximized ? (
              <Square className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            title="Close"
            onClick={handleClose}
            className={cn(
              'flex h-full w-10 items-center justify-center text-muted-foreground transition-colors',
              'hover:bg-destructive hover:text-destructive-foreground'
            )}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <AddServerDialog open={addServerOpen} onOpenChange={setAddServerOpen} />
    </>
  );
}

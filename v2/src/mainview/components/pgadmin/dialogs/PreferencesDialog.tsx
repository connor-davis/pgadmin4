//////////////////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2026, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////////////////
import { type CSSProperties, useMemo, useState } from 'react';

import { Palette, PanelLeft, Settings2 } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import {
  THEME_VAR_SECTIONS,
  usePreferences,
  type ThemeVariableSection,
} from '@/store/preferences';

interface PreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PreferencesSectionId = 'appearance' | 'general' | 'sidebar';

const NAV_ITEMS: {
  id: PreferencesSectionId;
  label: string;
  icon: typeof Palette;
}[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'sidebar', label: 'Sidebar', icon: PanelLeft },
  { id: 'general', label: 'General', icon: Settings2 },
];

function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const options: { value: string; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  return (
    <div className="grid gap-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Theme Mode</h3>
        <p className="text-xs text-muted-foreground">
          Choose whether Viper should follow the light theme, dark theme, or
          your system preference.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={theme === option.value ? 'default' : 'outline'}
            onClick={() => setTheme(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ThemeVariableEditor({ sections }: { sections: ThemeVariableSection[] }) {
  const { prefs, setCssVar } = usePreferences();

  return (
    <div className="grid gap-6">
      {sections.map((section) => (
        <section key={section.id} className="grid gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {section.label}
            </h3>
            <p className="text-xs text-muted-foreground">
              {section.description}
            </p>
          </div>

          <div className="grid gap-2">
            {section.variables.map((variable) => (
              <div
                key={variable.key}
                className="grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 lg:grid-cols-[minmax(0,14rem)_1fr]"
              >
                <div className="space-y-1">
                  <Label htmlFor={`css-var-${variable.key}`} className="text-xs">
                    {variable.label}
                  </Label>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {variable.key}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 shrink-0 rounded-md border border-border"
                    style={{
                      backgroundColor:
                        prefs.cssVarOverrides[variable.key] ||
                        `var(${variable.key})`,
                    }}
                  />
                  <Input
                    id={`css-var-${variable.key}`}
                    placeholder={`var(${variable.key})`}
                    value={prefs.cssVarOverrides[variable.key] ?? ''}
                    onChange={(event) =>
                      setCssVar(variable.key, event.target.value)
                    }
                    className="min-w-0 flex-1 font-mono text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AppearancePanel() {
  const appearanceSections = THEME_VAR_SECTIONS.filter(
    (section) => section.category === 'appearance'
  );

  return (
    <div className="grid gap-8">
      <ThemeSelector />
      <ThemeVariableEditor sections={appearanceSections} />
    </div>
  );
}

function SidebarPanel() {
  const sidebarSections = THEME_VAR_SECTIONS.filter(
    (section) => section.category === 'sidebar'
  );

  return <ThemeVariableEditor sections={sidebarSections} />;
}

function GeneralPanel() {
  return (
    <div className="grid gap-3">
      <h3 className="text-sm font-semibold text-foreground">General</h3>
      <p className="text-sm text-muted-foreground">
        Additional application preferences can be added here as the desktop
        rewrite grows. For now, appearance and sidebar settings are fully
        editable.
      </p>
    </div>
  );
}

export function PreferencesDialog({
  open,
  onOpenChange,
}: PreferencesDialogProps) {
  const [activeSection, setActiveSection] =
    useState<PreferencesSectionId>('appearance');
  const { prefs, resetCssVars } = usePreferences();

  const overrideCount = useMemo(
    () =>
      Object.values(prefs.cssVarOverrides).filter((value) => value.trim().length > 0)
        .length,
    [prefs.cssVarOverrides]
  );

  const sidebarOverrideCount = useMemo(() => {
    const sidebarKeys = new Set(
      THEME_VAR_SECTIONS.filter((section) => section.category === 'sidebar')
        .flatMap((section) => section.variables.map((variable) => variable.key))
    );

    return Object.entries(prefs.cssVarOverrides).filter(
      ([key, value]) => sidebarKeys.has(key) && value.trim().length > 0
    ).length;
  }, [prefs.cssVarOverrides]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,80rem)]">
        <DialogTitle className="sr-only">Preferences</DialogTitle>

        <div className="flex h-[min(90vh,48rem)] min-h-0 flex-col">
          <div className="border-b border-border px-6 py-4">
            <DialogTitle>Preferences</DialogTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Customize the application theme, sidebar colours, and related UI
              tokens. Overrides are stored locally on this desktop client.
            </p>
          </div>

          <SidebarProvider
            defaultOpen
            className="min-h-0 flex-1 flex-col md:flex-row"
            style={
              {
                '--sidebar-width': '13rem',
              } as CSSProperties
            }
          >
            <Sidebar
              collapsible="none"
              className="h-auto w-full border-b border-sidebar-border bg-sidebar/70 md:h-full md:w-(--sidebar-width) md:border-r md:border-b-0"
            >
              <SidebarHeader>
                <div className="rounded-lg border border-sidebar-border/70 bg-sidebar px-3 py-2">
                  <p className="text-sm font-semibold text-sidebar-foreground">
                    Settings
                  </p>
                  <p className="text-xs text-sidebar-foreground/70">
                    {overrideCount} custom override
                    {overrideCount === 1 ? '' : 's'} active
                  </p>
                </div>
              </SidebarHeader>

              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupLabel>Categories</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const badge =
                          item.id === 'sidebar'
                            ? sidebarOverrideCount
                            : item.id === 'appearance'
                              ? overrideCount - sidebarOverrideCount
                              : 0;

                        return (
                          <SidebarMenuItem key={item.id}>
                            <SidebarMenuButton
                              isActive={activeSection === item.id}
                              onClick={() => setActiveSection(item.id)}
                            >
                              <Icon />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                            {badge > 0 && <SidebarMenuBadge>{badge}</SidebarMenuBadge>}
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>

              <SidebarFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetCssVars}
                  disabled={overrideCount === 0}
                  className="w-full justify-start"
                >
                  Reset all overrides
                </Button>
              </SidebarFooter>
            </Sidebar>

            <div className="flex min-w-0 flex-1 flex-col bg-background">
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {activeSection === 'appearance' && <AppearancePanel />}
                {activeSection === 'sidebar' && <SidebarPanel />}
                {activeSection === 'general' && <GeneralPanel />}
              </div>

              <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-2xl text-xs text-muted-foreground">
                  Enter any valid CSS colour value such as hex, oklch, rgb, or
                  hsl. Leave a field blank to fall back to the active theme.
                </p>
                <Button onClick={() => onOpenChange(false)} className="self-start sm:self-auto">
                  Close
                </Button>
              </div>
            </div>
          </SidebarProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
}

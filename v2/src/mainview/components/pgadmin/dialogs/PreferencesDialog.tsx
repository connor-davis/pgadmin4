import { useTheme } from 'next-themes';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { THEME_VAR_LABELS, usePreferences } from '@/store/preferences';

interface PreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Theme Selector ────────────────────────────────────────────────────────────

function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const options: { value: string; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  return (
    <div className="grid gap-2">
      <Label>Theme</Label>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={
              'flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors ' +
              (theme === opt.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground')
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── CSS Variable Editor ───────────────────────────────────────────────────────

function CssVarEditor() {
  const { prefs, setCssVar, resetCssVars } = usePreferences();

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Colour Overrides</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={resetCssVars}
          disabled={Object.keys(prefs.cssVarOverrides).length === 0}
        >
          Reset to defaults
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Enter valid CSS colour values (hex, oklch, rgb, hsl…). Leave blank to
        use the theme default.
      </p>
      <div className="grid gap-2">
        {Object.entries(THEME_VAR_LABELS).map(([key, label]) => (
          <div key={key} className="grid grid-cols-[1fr_2fr] items-center gap-3">
            <Label htmlFor={`css-var-${key}`} className="text-xs">
              {label}
            </Label>
            <div className="flex items-center gap-2">
              {/* Colour swatch preview */}
              <div
                className="h-6 w-6 shrink-0 rounded border border-border"
                style={{
                  backgroundColor: prefs.cssVarOverrides[key] || `var(${key})`,
                }}
              />
              <Input
                id={`css-var-${key}`}
                placeholder={`var(${key})`}
                value={prefs.cssVarOverrides[key] ?? ''}
                onChange={(e) => setCssVar(key, e.target.value)}
                className="h-7 font-mono text-xs"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main dialog ───────────────────────────────────────────────────────────────

export function PreferencesDialog({ open, onOpenChange }: PreferencesDialogProps) {
  const [activeTab, setActiveTab] = useState('appearance');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Preferences</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList className="shrink-0">
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="appearance" className="mt-4 grid gap-6 px-1">
              <ThemeSelector />
              <Separator />
              <CssVarEditor />
            </TabsContent>

            <TabsContent value="general" className="mt-4 px-1">
              <p className="text-sm text-muted-foreground">
                General preferences will be available in a future update.
              </p>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="shrink-0 pt-2">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

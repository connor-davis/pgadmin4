//////////////////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2026, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////////////////
import { Eraser } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const STORAGE_KEY = 'viper-scratch-pad';

export function ScratchPadTab() {
  const [value, setValue] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? ''
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, value);
  }, [value]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/20 px-3 py-1.5">
        <div>
          <p className="text-sm font-semibold text-foreground">Scratch Pad</p>
          <p className="text-xs text-muted-foreground">
            Notes are autosaved locally on this machine.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setValue('')}
          disabled={!value}
        >
          <Eraser className="mr-2 h-3.5 w-3.5" />
          Clear
        </Button>
      </div>

      <div className="flex-1 p-3">
        <Textarea
          className="h-full min-h-full resize-none font-mono text-sm"
          placeholder="Write notes, snippets, TODOs, or throwaway SQL here..."
          spellCheck={false}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
    </div>
  );
}

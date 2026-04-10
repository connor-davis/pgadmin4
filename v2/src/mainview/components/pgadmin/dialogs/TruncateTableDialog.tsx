import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { queryKeys, rpc } from '@/lib/rpc';

type TruncateMode = 'plain' | 'cascade' | 'restart' | 'cascade_restart';

interface TruncateTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  database: string;
  schema: string;
  table: string;
  /** If set, the mode is fixed and the selector is hidden */
  initialMode?: TruncateMode;
}

const MODE_LABELS: Record<TruncateMode, string> = {
  plain: 'Truncate',
  cascade: 'Truncate Cascade',
  restart: 'Truncate Restart Identity',
  cascade_restart: 'Truncate Cascade + Restart Identity',
};

export function TruncateTableDialog({
  open,
  onOpenChange,
  serverId,
  database,
  schema,
  table,
  initialMode,
}: TruncateTableDialogProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<TruncateMode>(initialMode ?? 'plain');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync mode if initialMode prop changes (e.g. dialog reused for different actions)
  const effectiveMode = initialMode ?? mode;

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await rpc.truncateTable(serverId, database, schema, table, effectiveMode);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tableData(serverId, database, schema, table),
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Truncate failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Truncate Table</DialogTitle>
          <DialogDescription>
            Remove all rows from <strong>{schema}.{table}</strong>. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {!initialMode && (
          <div className="grid gap-1.5">
            <Label htmlFor="truncate-mode">Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as TruncateMode)}>
              <SelectTrigger id="truncate-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(MODE_LABELS) as [TruncateMode, string][]).map(
                  ([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {initialMode && (
          <p className="text-sm text-muted-foreground">
            Mode: <span className="font-medium text-foreground">{MODE_LABELS[initialMode]}</span>
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {MODE_LABELS[effectiveMode]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

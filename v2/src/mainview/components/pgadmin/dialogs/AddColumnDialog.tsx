import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type ColumnDef, queryKeys, rpc } from '@/lib/rpc';

const PG_TYPES = [
  'text',
  'varchar(255)',
  'integer',
  'bigint',
  'smallint',
  'boolean',
  'numeric',
  'decimal',
  'real',
  'double precision',
  'timestamp',
  'timestamptz',
  'date',
  'time',
  'uuid',
  'jsonb',
  'json',
  'bytea',
  'serial',
  'bigserial',
];

interface AddColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  database: string;
  schema: string;
  table: string;
}

const defaultCol = (): ColumnDef => ({
  name: '',
  type: 'text',
  nullable: true,
  primaryKey: false,
  defaultValue: '',
});

export function AddColumnDialog({
  open,
  onOpenChange,
  serverId,
  database,
  schema,
  table,
}: AddColumnDialogProps) {
  const queryClient = useQueryClient();
  const [col, setCol] = useState<ColumnDef>(defaultCol());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(p: Partial<ColumnDef>) {
    setCol((c) => ({ ...c, ...p }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const colToSend: ColumnDef = {
        ...col,
        defaultValue: col.defaultValue || undefined,
      };
      await rpc.addColumn(serverId, database, schema, table, colToSend);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.columns(serverId, database, schema, table),
      });
      setCol(defaultCol());
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add column');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Add Column to "{schema}.{table}"
          </DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <Label htmlFor="col-name">Column Name</Label>
            <Input
              id="col-name"
              placeholder="column_name"
              required
              value={col.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="col-type">Type</Label>
            <Select
              value={col.type}
              onValueChange={(v) => v !== null && patch({ type: v })}
            >
              <SelectTrigger id="col-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PG_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="col-default">Default Value</Label>
            <Input
              id="col-default"
              placeholder="optional"
              value={col.defaultValue ?? ''}
              onChange={(e) => patch({ defaultValue: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!col.nullable}
                onChange={(e) => patch({ nullable: !e.target.checked })}
                className="h-4 w-4"
              />
              NOT NULL
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!col.primaryKey}
                onChange={(e) => patch({ primaryKey: e.target.checked })}
                className="h-4 w-4"
              />
              Primary Key
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Column
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
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

type ColRow = ColumnDef & { _id: number };

let _nextId = 1;
function makeCol(): ColRow {
  return {
    _id: _nextId++,
    name: '',
    type: 'text',
    nullable: true,
    primaryKey: false,
    defaultValue: '',
  };
}

interface CreateTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  database: string;
  schema: string;
}

export function CreateTableDialog({
  open,
  onOpenChange,
  serverId,
  database,
  schema,
}: CreateTableDialogProps) {
  const queryClient = useQueryClient();
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColRow[]>([makeCol()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addColumn() {
    setColumns((cols) => [...cols, makeCol()]);
  }

  function removeColumn(id: number) {
    setColumns((cols) => cols.filter((c) => c._id !== id));
  }

  function updateColumn(id: number, patch: Partial<ColRow>) {
    setColumns((cols) =>
      cols.map((c) => (c._id === id ? { ...c, ...patch } : c))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const cols: ColumnDef[] = columns.map(({ ...rest }) => ({
        ...rest,
        defaultValue: rest.defaultValue || undefined,
      }));
      await rpc.createTable(serverId, database, schema, tableName.trim(), cols);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tables(serverId, database, schema),
      });
      setTableName('');
      setColumns([makeCol()]);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create table');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Table in "{schema}"</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <Label htmlFor="tbl-name">Table Name</Label>
            <Input
              id="tbl-name"
              placeholder="my_table"
              required
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
            />
          </div>

          {/* Columns */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Columns</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addColumn}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Column
              </Button>
            </div>

            {/* Header row */}
            <div className="grid grid-cols-[1fr_1fr_auto_auto_1fr_auto] gap-1 mb-1 text-xs font-medium text-muted-foreground px-1">
              <span>Name</span>
              <span>Type</span>
              <span>Not Null</span>
              <span>PK</span>
              <span>Default</span>
              <span />
            </div>

            <div className="space-y-1">
              {columns.map((col) => (
                <div
                  key={col._id}
                  className="grid grid-cols-[1fr_1fr_auto_auto_1fr_auto] gap-1 items-center"
                >
                  <Input
                    placeholder="column_name"
                    required
                    value={col.name}
                    onChange={(e) =>
                      updateColumn(col._id, { name: e.target.value })
                    }
                    className="h-7 text-xs"
                  />
                  <Select
                    value={col.type}
                    onValueChange={(v) =>
                      v !== null && updateColumn(col._id, { type: v })
                    }
                  >
                    <SelectTrigger size="sm" className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PG_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    type="checkbox"
                    title="NOT NULL"
                    checked={!col.nullable}
                    onChange={(e) =>
                      updateColumn(col._id, { nullable: !e.target.checked })
                    }
                    className="h-4 w-4 mx-auto"
                  />
                  <input
                    type="checkbox"
                    title="Primary Key"
                    checked={!!col.primaryKey}
                    onChange={(e) =>
                      updateColumn(col._id, { primaryKey: e.target.checked })
                    }
                    className="h-4 w-4 mx-auto"
                  />
                  <Input
                    placeholder="default value"
                    value={col.defaultValue ?? ''}
                    onChange={(e) =>
                      updateColumn(col._id, { defaultValue: e.target.value })
                    }
                    className="h-7 text-xs"
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => removeColumn(col._id)}
                    disabled={columns.length === 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Table
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

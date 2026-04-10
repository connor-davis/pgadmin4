import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  Database,
  FileCode2,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  Table2,
  Terminal,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

import { toast } from 'sonner';

import { ConfirmDropDialog } from '@/components/pgadmin/dialogs/ConfirmDropDialog';
import { CreateDatabaseDialog } from '@/components/pgadmin/dialogs/CreateDatabaseDialog';
import { CreateSchemaDialog } from '@/components/pgadmin/dialogs/CreateSchemaDialog';
import { CreateTableDialog } from '@/components/pgadmin/dialogs/CreateTableDialog';
import { AddColumnDialog } from '@/components/pgadmin/dialogs/AddColumnDialog';
import { TruncateTableDialog } from '@/components/pgadmin/dialogs/TruncateTableDialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { ColumnInfo } from '@/lib/rpc';
import { queryKeys, rpc } from '@/lib/rpc';
import { useWorkspace } from '@/store/workspace';

// ─── ObjectExplorer root ──────────────────────────────────────────────────────

export function ObjectExplorer({ onAddServer }: { onAddServer: () => void }) {
  const { data: servers = [], isLoading } = useQuery({
    queryKey: queryKeys.servers(),
    queryFn: rpc.listServers,
  });

  return (
    <div className="flex h-full flex-col">
      {/* Tree */}
      <div className="flex-1 overflow-auto p-1">
        {isLoading && (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && servers.length === 0 && (
          <div className="p-3 text-xs text-muted-foreground">
            No servers configured.{' '}
            <button
              className="underline hover:text-foreground"
              onClick={onAddServer}
            >
              Add one to get started.
            </button>
          </div>
        )}
        {!isLoading && servers.length > 0 && (
          <ul className="space-y-0.5 text-sm">
            {servers.map((server) => (
              <ServerNode key={server.id} server={server} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function NodeRow({
  depth,
  icon,
  label,
  meta,
  open,
  onClick,
}: {
  depth: number;
  icon: React.ReactNode;
  label: string;
  meta?: string;
  open?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className="group flex w-full items-center gap-1 rounded px-2 py-0.5 hover:bg-sidebar-accent text-sidebar-foreground cursor-pointer"
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      onClick={onClick}
    >
      {open !== undefined ? (
        open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )
      ) : (
        <span className="w-3 shrink-0" />
      )}
      {icon}
      <span className="truncate flex-1">{label}</span>
      {meta && (
        <span className="ml-auto text-xs text-muted-foreground truncate shrink-0">
          {meta}
        </span>
      )}
    </div>
  );
}

// ─── ServerNode ───────────────────────────────────────────────────────────────

function ServerNode({
  server,
}: {
  server: { id: string; name: string; host: string; port: number };
}) {
  const [open, setOpen] = useState(false);
  const [createDbOpen, setCreateDbOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: databases = [], isLoading } = useQuery({
    queryKey: queryKeys.databases(server.id),
    queryFn: () => rpc.getDatabases(server.id),
    enabled: open,
  });

  function handleClick() {
    setOpen((o) => !o);
  }

  async function handleRemove() {
    await rpc.deleteServer(server.id);
    await queryClient.invalidateQueries({ queryKey: queryKeys.servers() });
  }

  async function handleRefresh() {
    try {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.databases(server.id),
      });
      toast.success('Server refreshed');
    } catch {
      toast.error('Failed to refresh server');
    }
  }

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger>
          <NodeRow
            depth={0}
            icon={<Server className="h-3 w-3 shrink-0 text-primary" />}
            label={server.name}
            meta={`${server.host}:${server.port}`}
            open={open}
            onClick={handleClick}
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setCreateDbOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Create Database
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onClick={() => setRemoveOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove Server
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {open && (
        <ul>
          {isLoading ? (
            <li className="pl-8 py-1">
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            </li>
          ) : (
            databases.map((db) => (
              <DatabaseNode key={db.name} serverId={server.id} db={db} />
            ))
          )}
        </ul>
      )}

      <CreateDatabaseDialog
        open={createDbOpen}
        onOpenChange={setCreateDbOpen}
        serverId={server.id}
      />
      <ConfirmDropDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove Server"
        description={`Remove "${server.name}" (${server.host}:${server.port}) from pgAdmin? The server itself will not be affected.`}
        confirmLabel="Remove"
        onConfirm={handleRemove}
      />
    </li>
  );
}

// ─── DatabaseNode ─────────────────────────────────────────────────────────────

function DatabaseNode({
  serverId,
  db,
}: {
  serverId: string;
  db: { name: string; owner: string };
}) {
  const [open, setOpen] = useState(false);
  const [createSchemaOpen, setCreateSchemaOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const queryClient = useQueryClient();
  const { openQueryTool } = useWorkspace();

  const { data: schemas = [], isLoading } = useQuery({
    queryKey: queryKeys.schemas(serverId, db.name),
    queryFn: () => rpc.getSchemas(serverId, db.name),
    enabled: open,
  });

  function handleClick() {
    setOpen((o) => !o);
  }

  async function handleDrop() {
    await rpc.dropDatabase(serverId, db.name);
    await queryClient.invalidateQueries({
      queryKey: queryKeys.databases(serverId),
    });
  }

  async function handleRefresh() {
    try {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.schemas(serverId, db.name),
      });
      toast.success('Database refreshed');
    } catch {
      toast.error('Failed to refresh database');
    }
  }

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger>
          <NodeRow
            depth={1}
            icon={<Database className="h-3 w-3 shrink-0 text-primary" />}
            label={db.name}
            open={open}
            onClick={handleClick}
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setCreateSchemaOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Create Schema
          </ContextMenuItem>
          <ContextMenuItem onClick={() => openQueryTool(serverId, db.name)}>
            <Terminal className="h-3.5 w-3.5" />
            Open Query Tool
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onClick={() => setDropOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Drop Database
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {open && (
        <ul>
          {isLoading ? (
            <li className="pl-10 py-1">
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            </li>
          ) : (
            schemas.map((schema) => (
              <SchemaNode
                key={schema.name}
                serverId={serverId}
                database={db.name}
                schema={schema}
              />
            ))
          )}
        </ul>
      )}

      <CreateSchemaDialog
        open={createSchemaOpen}
        onOpenChange={setCreateSchemaOpen}
        serverId={serverId}
        database={db.name}
      />
      <ConfirmDropDialog
        open={dropOpen}
        onOpenChange={setDropOpen}
        title="Drop Database"
        description={`This will permanently drop database "${db.name}" and all its data. This cannot be undone.`}
        onConfirm={handleDrop}
      />
    </li>
  );
}

// ─── SchemaNode ───────────────────────────────────────────────────────────────

function SchemaNode({
  serverId,
  database,
  schema,
}: {
  serverId: string;
  database: string;
  schema: { name: string; owner: string };
}) {
  const [open, setOpen] = useState(false);
  const [createTableOpen, setCreateTableOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: tables = [], isLoading } = useQuery({
    queryKey: queryKeys.tables(serverId, database, schema.name),
    queryFn: () => rpc.getTables(serverId, database, schema.name),
    enabled: open,
  });

  async function handleDrop() {
    await rpc.dropSchema(serverId, database, schema.name, true);
    await queryClient.invalidateQueries({
      queryKey: queryKeys.schemas(serverId, database),
    });
  }

  async function handleRefresh() {
    try {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tables(serverId, database, schema.name),
      });
      toast.success('Schema refreshed');
    } catch {
      toast.error('Failed to refresh schema');
    }
  }

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger>
          <NodeRow
            depth={2}
            icon={<Layers className="h-3 w-3 shrink-0 text-amber-500" />}
            label={schema.name}
            open={open}
            onClick={() => setOpen((o) => !o)}
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setCreateTableOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Create Table
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onClick={() => setDropOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Drop Schema
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {open && (
        <ul>
          {isLoading ? (
            <li className="pl-12 py-1">
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            </li>
          ) : (
            tables.map((table) => (
              <TableNode
                key={`${table.schema}.${table.name}`}
                serverId={serverId}
                database={database}
                schema={schema.name}
                table={table}
              />
            ))
          )}
        </ul>
      )}

      <CreateTableDialog
        open={createTableOpen}
        onOpenChange={setCreateTableOpen}
        serverId={serverId}
        database={database}
        schema={schema.name}
      />
      <ConfirmDropDialog
        open={dropOpen}
        onOpenChange={setDropOpen}
        title="Drop Schema"
        description={`This will drop schema "${schema.name}" and all objects within it (CASCADE). This cannot be undone.`}
        onConfirm={handleDrop}
      />
    </li>
  );
}

// ─── Script generators ────────────────────────────────────────────────────────

function buildSelectScript(schema: string, table: string, cols: ColumnInfo[]) {
  const colList = cols.map((c) => `  "${c.name}"`).join(',\n');
  return `SELECT\n${colList}\nFROM "${schema}"."${table}";`;
}

function buildInsertScript(schema: string, table: string, cols: ColumnInfo[]) {
  const colList = cols.map((c) => `"${c.name}"`).join(', ');
  const valList = cols.map((c) => `<${c.name}>`).join(', ');
  return `INSERT INTO "${schema}"."${table}" (${colList})\nVALUES (${valList});`;
}

function buildUpdateScript(schema: string, table: string, cols: ColumnInfo[]) {
  const setClauses = cols.map((c) => `  "${c.name}" = <${c.name}>`).join(',\n');
  return `UPDATE "${schema}"."${table}"\nSET\n${setClauses}\nWHERE <condition>;`;
}

function buildDeleteScript(schema: string, table: string) {
  return `DELETE FROM "${schema}"."${table}"\nWHERE <condition>;`;
}

function buildCreateScript(schema: string, table: string, cols: ColumnInfo[]) {
  const colDefs = cols
    .map((c) => `  "${c.name}" ${c.type}${c.nullable ? '' : ' NOT NULL'}`)
    .join(',\n');
  return `CREATE TABLE "${schema}"."${table}" (\n${colDefs}\n);`;
}

// ─── TableNode ────────────────────────────────────────────────────────────────

function TableNode({
  serverId,
  database,
  schema,
  table,
}: {
  serverId: string;
  database: string;
  schema: string;
  table: { name: string; type: string };
}) {
  const [open, setOpen] = useState(false);
  const [dropCascade, setDropCascade] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [truncateMode, setTruncateMode] = useState<'plain' | 'cascade' | 'restart' | 'cascade_restart'>('plain');
  const [truncateOpen, setTruncateOpen] = useState(false);
  const queryClient = useQueryClient();
  const { openQueryTool, openScript } = useWorkspace();

  async function handleDrop() {
    await rpc.dropTable(serverId, database, schema, table.name, dropCascade);
    await queryClient.invalidateQueries({
      queryKey: queryKeys.tables(serverId, database, schema),
    });
  }

  function openTruncate(mode: 'plain' | 'cascade' | 'restart' | 'cascade_restart') {
    setTruncateMode(mode);
    setTruncateOpen(true);
  }

  function openDrop(cascade: boolean) {
    setDropCascade(cascade);
    setDropOpen(true);
  }

  function viewData(mode: 'all' | 'first' | 'last' | 'filtered') {
    const q = `"${schema}"."${table.name}"`;
    let sql: string;
    if (mode === 'all') {
      sql = `SELECT *\nFROM ${q};`;
    } else if (mode === 'last') {
      sql = `SELECT *\nFROM (\n  SELECT * FROM ${q} ORDER BY ctid DESC LIMIT 100\n) subq\nORDER BY ctid;`;
    } else if (mode === 'filtered') {
      sql = `SELECT *\nFROM ${q}\nWHERE -- add your conditions here\n;`;
    } else {
      sql = `SELECT *\nFROM ${q}\nLIMIT 100;`;
    }
    const modeLabel = mode === 'all' ? 'All Rows' : mode === 'last' ? 'Last 100' : mode === 'filtered' ? 'Filtered' : 'First 100';
    openScript(serverId, database, `${schema}.${table.name} — ${modeLabel}`, sql);
  }

  async function handleRefresh() {
    try {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tables(serverId, database, schema),
      });
      toast.success('Tables refreshed');
    } catch {
      toast.error('Failed to refresh tables');
    }
  }

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger>
          <NodeRow
            depth={3}
            icon={<Table2 className="h-3 w-3 shrink-0 text-sky-500" />}
            label={table.name}
            meta={table.type === 'view' ? 'view' : undefined}
            open={open}
            onClick={() => setOpen((o) => !o)}
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
          {/* Scripts submenu */}
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <FileCode2 className="h-3.5 w-3.5" />
              Scripts
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ScriptItem
                serverId={serverId}
                database={database}
                schema={schema}
                table={table.name}
                kind="create"
                label="CREATE Script"
              />
              <ScriptItem
                serverId={serverId}
                database={database}
                schema={schema}
                table={table.name}
                kind="delete"
                label="DELETE Script"
              />
              <ScriptItem
                serverId={serverId}
                database={database}
                schema={schema}
                table={table.name}
                kind="insert"
                label="INSERT Script"
              />
              <ScriptItem
                serverId={serverId}
                database={database}
                schema={schema}
                table={table.name}
                kind="select"
                label="SELECT Script"
              />
              <ScriptItem
                serverId={serverId}
                database={database}
                schema={schema}
                table={table.name}
                kind="update"
                label="UPDATE Script"
              />
            </ContextMenuSubContent>
          </ContextMenuSub>
          {/* Truncate submenu */}
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Trash2 className="h-3.5 w-3.5" />
              Truncate
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => openTruncate('plain')}>
                Truncate
              </ContextMenuItem>
              <ContextMenuItem onClick={() => openTruncate('cascade')}>
                Truncate Cascade
              </ContextMenuItem>
              <ContextMenuItem onClick={() => openTruncate('restart')}>
                Truncate Restart Identity
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          {/* View/Edit Data submenu */}
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Terminal className="h-3.5 w-3.5" />
              View/Edit Data
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => viewData('all')}>
                All Rows
              </ContextMenuItem>
              <ContextMenuItem onClick={() => viewData('first')}>
                First 100 Rows
              </ContextMenuItem>
              <ContextMenuItem onClick={() => viewData('last')}>
                Last 100 Rows
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => viewData('filtered')}>
                Filtered Rows...
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => openQueryTool(serverId, database)}>
            <Terminal className="h-3.5 w-3.5" />
            Open Query Tool
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </ContextMenuItem>
          <ContextMenuSeparator />
          {/* Drop */}
          <ContextMenuItem
            variant="destructive"
            onClick={() => openDrop(false)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Drop
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            onClick={() => openDrop(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Drop (Cascade)
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Child nodes */}
      {open && (
        <ul>
          <ColumnsNode
            serverId={serverId}
            database={database}
            schema={schema}
            table={table.name}
            depth={4}
          />
          <ConstraintsNode
            serverId={serverId}
            database={database}
            schema={schema}
            table={table.name}
            depth={4}
          />
          <IndexesNode
            serverId={serverId}
            database={database}
            schema={schema}
            table={table.name}
            depth={4}
          />
          <RLSPoliciesNode
            serverId={serverId}
            database={database}
            schema={schema}
            table={table.name}
            depth={4}
          />
          <RulesNode
            serverId={serverId}
            database={database}
            schema={schema}
            table={table.name}
            depth={4}
          />
          <TriggersNode
            serverId={serverId}
            database={database}
            schema={schema}
            table={table.name}
            depth={4}
          />
        </ul>
      )}

      <ConfirmDropDialog
        open={dropOpen}
        onOpenChange={setDropOpen}
        title={dropCascade ? 'Drop Table (Cascade)' : 'Drop Table'}
        description={
          dropCascade
            ? `This will permanently drop "${schema}.${table.name}" and all dependent objects. This cannot be undone.`
            : `This will permanently drop table "${schema}.${table.name}". This cannot be undone.`
        }
        onConfirm={handleDrop}
      />
      <TruncateTableDialog
        open={truncateOpen}
        onOpenChange={setTruncateOpen}
        serverId={serverId}
        database={database}
        schema={schema}
        table={table.name}
        initialMode={truncateMode}
      />
    </li>
  );
}

// ─── ScriptItem ───────────────────────────────────────────────────────────────

function ScriptItem({
  serverId,
  database,
  schema,
  table,
  kind,
  label,
}: {
  serverId: string;
  database: string;
  schema: string;
  table: string;
  kind: 'create' | 'delete' | 'insert' | 'select' | 'update';
  label: string;
}) {
  const { openScript } = useWorkspace();

  async function handleClick() {
    try {
      const cols = await rpc.getColumns(serverId, database, schema, table);
      let sql = '';
      switch (kind) {
        case 'create':
          sql = buildCreateScript(schema, table, cols);
          break;
        case 'delete':
          sql = buildDeleteScript(schema, table);
          break;
        case 'insert':
          sql = buildInsertScript(schema, table, cols);
          break;
        case 'select':
          sql = buildSelectScript(schema, table, cols);
          break;
        case 'update':
          sql = buildUpdateScript(schema, table, cols);
          break;
      }
      openScript(
        serverId,
        database,
        `${kind.toUpperCase()} ${schema}.${table}`,
        sql
      );
    } catch (err) {
      toast.error(
        `Failed to generate script: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return <ContextMenuItem onClick={handleClick}>{label}</ContextMenuItem>;
}

// ─── Collection child nodes ───────────────────────────────────────────────────

function LeafRow({
  depth,
  icon,
  label,
  meta,
}: {
  depth: number;
  icon: React.ReactNode;
  label: string;
  meta?: string;
}) {
  return (
    <li>
      <NodeRow depth={depth} icon={icon} label={label} meta={meta} />
    </li>
  );
}

// ─── Columns collection ───────────────────────────────────────────────────────

function ColumnsNode({
  serverId,
  database,
  schema,
  table,
  depth,
}: {
  serverId: string;
  database: string;
  schema: string;
  table: string;
  depth: number;
}) {
  const [open, setOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const { data: columns = [], isLoading } = useQuery({
    queryKey: queryKeys.columns(serverId, database, schema, table),
    queryFn: () => rpc.getColumns(serverId, database, schema, table),
    enabled: open,
  });
  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger>
          <NodeRow
            depth={depth}
            icon={
              <span className="text-[9px] font-bold text-muted-foreground">C</span>
            }
            label="Columns"
            meta={open && !isLoading ? String(columns.length) : undefined}
            open={open}
            onClick={() => setOpen((o) => !o)}
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Plus className="h-3.5 w-3.5" />
              Create
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => setAddColumnOpen(true)}>
                Column...
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>
      {open && (
        <ul>
          {isLoading ? (
            <li
              className="py-0.5"
              style={{ paddingLeft: `${8 + (depth + 1) * 12}px` }}
            >
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            </li>
          ) : (
            columns.map((col) => (
              <LeafRow
                key={col.name}
                depth={depth + 1}
                icon={
                  <span className="text-[9px] text-muted-foreground">▪</span>
                }
                label={col.name}
                meta={col.type}
              />
            ))
          )}
        </ul>
      )}
      <AddColumnDialog
        open={addColumnOpen}
        onOpenChange={setAddColumnOpen}
        serverId={serverId}
        database={database}
        schema={schema}
        table={table}
      />
    </li>
  );
}

// ─── Constraints collection ───────────────────────────────────────────────────

function ConstraintsNode({
  serverId,
  database,
  schema,
  table,
  depth,
}: {
  serverId: string;
  database: string;
  schema: string;
  table: string;
  depth: number;
}) {
  const [open, setOpen] = useState(false);
  const { data: items = [], isLoading } = useQuery({
    queryKey: queryKeys.constraints(serverId, database, schema, table),
    queryFn: () => rpc.getConstraints(serverId, database, schema, table),
    enabled: open,
  });
  const typeLabel: Record<string, string> = {
    p: 'PRIMARY KEY',
    f: 'FOREIGN KEY',
    u: 'UNIQUE',
    c: 'CHECK',
    t: 'TRIGGER',
    x: 'EXCLUSION',
  };
  return (
    <li>
      <NodeRow
        depth={depth}
        icon={<span className="text-[9px] font-bold text-amber-600">K</span>}
        label="Constraints"
        meta={open && !isLoading ? String(items.length) : undefined}
        open={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <ul>
          {isLoading ? (
            <li
              className="py-0.5"
              style={{ paddingLeft: `${8 + (depth + 1) * 12}px` }}
            >
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            </li>
          ) : (
            items.map((item) => (
              <LeafRow
                key={item.name}
                depth={depth + 1}
                icon={<span className="text-[9px] text-amber-600">▪</span>}
                label={item.name}
                meta={typeLabel[item.type] ?? item.type}
              />
            ))
          )}
        </ul>
      )}
    </li>
  );
}

// ─── Indexes collection ───────────────────────────────────────────────────────

function IndexesNode({
  serverId,
  database,
  schema,
  table,
  depth,
}: {
  serverId: string;
  database: string;
  schema: string;
  table: string;
  depth: number;
}) {
  const [open, setOpen] = useState(false);
  const { data: items = [], isLoading } = useQuery({
    queryKey: queryKeys.indexes(serverId, database, schema, table),
    queryFn: () => rpc.getIndexes(serverId, database, schema, table),
    enabled: open,
  });
  return (
    <li>
      <NodeRow
        depth={depth}
        icon={<span className="text-[9px] font-bold text-purple-500">I</span>}
        label="Indexes"
        meta={open && !isLoading ? String(items.length) : undefined}
        open={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <ul>
          {isLoading ? (
            <li
              className="py-0.5"
              style={{ paddingLeft: `${8 + (depth + 1) * 12}px` }}
            >
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            </li>
          ) : (
            items.map((item) => (
              <LeafRow
                key={item.name}
                depth={depth + 1}
                icon={<span className="text-[9px] text-purple-500">▪</span>}
                label={item.name}
                meta={
                  item.primary ? 'primary' : item.unique ? 'unique' : undefined
                }
              />
            ))
          )}
        </ul>
      )}
    </li>
  );
}

// ─── RLS Policies collection ──────────────────────────────────────────────────

function RLSPoliciesNode({
  serverId,
  database,
  schema,
  table,
  depth,
}: {
  serverId: string;
  database: string;
  schema: string;
  table: string;
  depth: number;
}) {
  const [open, setOpen] = useState(false);
  const { data: items = [], isLoading } = useQuery({
    queryKey: queryKeys.rlsPolicies(serverId, database, schema, table),
    queryFn: () => rpc.getRLSPolicies(serverId, database, schema, table),
    enabled: open,
  });
  return (
    <li>
      <NodeRow
        depth={depth}
        icon={<span className="text-[9px] font-bold text-green-600">P</span>}
        label="RLS Policies"
        meta={open && !isLoading ? String(items.length) : undefined}
        open={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <ul>
          {isLoading ? (
            <li
              className="py-0.5"
              style={{ paddingLeft: `${8 + (depth + 1) * 12}px` }}
            >
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            </li>
          ) : (
            items.map((item) => (
              <LeafRow
                key={item.name}
                depth={depth + 1}
                icon={<span className="text-[9px] text-green-600">▪</span>}
                label={item.name}
                meta={item.cmd}
              />
            ))
          )}
        </ul>
      )}
    </li>
  );
}

// ─── Rules collection ─────────────────────────────────────────────────────────

function RulesNode({
  serverId,
  database,
  schema,
  table,
  depth,
}: {
  serverId: string;
  database: string;
  schema: string;
  table: string;
  depth: number;
}) {
  const [open, setOpen] = useState(false);
  const { data: items = [], isLoading } = useQuery({
    queryKey: queryKeys.rules(serverId, database, schema, table),
    queryFn: () => rpc.getRules(serverId, database, schema, table),
    enabled: open,
  });
  return (
    <li>
      <NodeRow
        depth={depth}
        icon={<span className="text-[9px] font-bold text-orange-500">R</span>}
        label="Rules"
        meta={open && !isLoading ? String(items.length) : undefined}
        open={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <ul>
          {isLoading ? (
            <li
              className="py-0.5"
              style={{ paddingLeft: `${8 + (depth + 1) * 12}px` }}
            >
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            </li>
          ) : (
            items.map((item) => (
              <LeafRow
                key={item.name}
                depth={depth + 1}
                icon={<span className="text-[9px] text-orange-500">▪</span>}
                label={item.name}
              />
            ))
          )}
        </ul>
      )}
    </li>
  );
}

// ─── Triggers collection ──────────────────────────────────────────────────────

function TriggersNode({
  serverId,
  database,
  schema,
  table,
  depth,
}: {
  serverId: string;
  database: string;
  schema: string;
  table: string;
  depth: number;
}) {
  const [open, setOpen] = useState(false);
  const { data: items = [], isLoading } = useQuery({
    queryKey: queryKeys.triggers(serverId, database, schema, table),
    queryFn: () => rpc.getTriggers(serverId, database, schema, table),
    enabled: open,
  });
  return (
    <li>
      <NodeRow
        depth={depth}
        icon={<span className="text-[9px] font-bold text-rose-500">T</span>}
        label="Triggers"
        meta={open && !isLoading ? String(items.length) : undefined}
        open={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <ul>
          {isLoading ? (
            <li
              className="py-0.5"
              style={{ paddingLeft: `${8 + (depth + 1) * 12}px` }}
            >
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            </li>
          ) : (
            items.map((item) => (
              <LeafRow
                key={item.name}
                depth={depth + 1}
                icon={<span className="text-[9px] text-rose-500">▪</span>}
                label={item.name}
                meta={`${item.timing} ${item.event}`}
              />
            ))
          )}
        </ul>
      )}
    </li>
  );
}

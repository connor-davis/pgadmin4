import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  ChevronDown,
  ChevronRight,
  Database,
  Layers,
  Loader2,
  Plus,
  Server,
  Table2,
  Terminal,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

import { ConfirmDropDialog } from '@/components/pgadmin/dialogs/ConfirmDropDialog';
import { CreateDatabaseDialog } from '@/components/pgadmin/dialogs/CreateDatabaseDialog';
import { CreateSchemaDialog } from '@/components/pgadmin/dialogs/CreateSchemaDialog';
import { CreateTableDialog } from '@/components/pgadmin/dialogs/CreateTableDialog';
import { queryKeys, rpc } from '@/lib/rpc';
import { cn } from '@/lib/utils';

// ─── ObjectExplorer root ──────────────────────────────────────────────────────

export function ObjectExplorer() {
  const { data: servers = [], isLoading } = useQuery({
    queryKey: queryKeys.servers(),
    queryFn: rpc.listServers,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No servers configured. Add one to get started.
      </div>
    );
  }

  return (
    <ul className="space-y-0.5 text-sm">
      {servers.map((server) => (
        <ServerNode key={server.id} server={server} />
      ))}
    </ul>
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
  actions,
}: {
  depth: number;
  icon: React.ReactNode;
  label: string;
  meta?: string;
  open?: boolean;
  onClick?: () => void;
  actions?: React.ReactNode;
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
      {meta && <span className="ml-auto text-xs text-muted-foreground truncate shrink-0">{meta}</span>}
      {actions && (
        <span
          className="ml-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </span>
      )}
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  children,
  destructive,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        'flex h-4 w-4 items-center justify-center rounded hover:bg-muted',
        destructive && 'hover:text-destructive'
      )}
    >
      {children}
    </button>
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
  const navigate = useNavigate();

  const { data: databases = [], isLoading } = useQuery({
    queryKey: queryKeys.databases(server.id),
    queryFn: () => rpc.getDatabases(server.id),
    enabled: open,
  });

  function handleClick() {
    setOpen((o) => !o);
    navigate({ to: '/servers/$serverId', params: { serverId: server.id } });
  }

  return (
    <li>
      <NodeRow
        depth={0}
        icon={<Server className="h-3 w-3 shrink-0 text-primary" />}
        label={server.name}
        meta={`${server.host}:${server.port}`}
        open={open}
        onClick={handleClick}
        actions={
          <>
            <IconBtn title="Create Database" onClick={() => setCreateDbOpen(true)}>
              <Plus className="h-2.5 w-2.5" />
            </IconBtn>
          </>
        }
      />

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
  const navigate = useNavigate();

  const { data: schemas = [], isLoading } = useQuery({
    queryKey: queryKeys.schemas(serverId, db.name),
    queryFn: () => rpc.getSchemas(serverId, db.name),
    enabled: open,
  });

  function handleClick() {
    setOpen((o) => !o);
    navigate({
      to: '/servers/$serverId/databases/$dbId',
      params: { serverId, dbId: db.name },
    });
  }

  async function handleDrop() {
    await rpc.dropDatabase(serverId, db.name);
    await queryClient.invalidateQueries({ queryKey: queryKeys.databases(serverId) });
  }

  return (
    <li>
      <NodeRow
        depth={1}
        icon={<Database className="h-3 w-3 shrink-0 text-primary" />}
        label={db.name}
        open={open}
        onClick={handleClick}
        actions={
          <>
            <IconBtn title="Create Schema" onClick={() => setCreateSchemaOpen(true)}>
              <Plus className="h-2.5 w-2.5" />
            </IconBtn>
            <IconBtn
              title="Open Query Tool"
              onClick={() =>
                navigate({
                  to: '/servers/$serverId/databases/$dbId/query',
                  params: { serverId, dbId: db.name },
                })
              }
            >
              <Terminal className="h-2.5 w-2.5" />
            </IconBtn>
            <IconBtn title="Drop Database" onClick={() => setDropOpen(true)} destructive>
              <Trash2 className="h-2.5 w-2.5" />
            </IconBtn>
          </>
        }
      />

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
    await queryClient.invalidateQueries({ queryKey: queryKeys.schemas(serverId, database) });
  }

  return (
    <li>
      <NodeRow
        depth={2}
        icon={<Layers className="h-3 w-3 shrink-0 text-amber-500" />}
        label={schema.name}
        open={open}
        onClick={() => setOpen((o) => !o)}
        actions={
          <>
            <IconBtn title="Create Table" onClick={() => setCreateTableOpen(true)}>
              <Plus className="h-2.5 w-2.5" />
            </IconBtn>
            <IconBtn title="Drop Schema" onClick={() => setDropOpen(true)} destructive>
              <Trash2 className="h-2.5 w-2.5" />
            </IconBtn>
          </>
        }
      />

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
  const [dropOpen, setDropOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function handleDrop() {
    await rpc.dropTable(serverId, database, schema, table.name, true);
    await queryClient.invalidateQueries({ queryKey: queryKeys.tables(serverId, database, schema) });
  }

  return (
    <li>
      <NodeRow
        depth={3}
        icon={<Table2 className="h-3 w-3 shrink-0 text-sky-500" />}
        label={table.name}
        meta={table.type === 'view' ? 'view' : undefined}
        onClick={() =>
          navigate({
            to: '/servers/$serverId/databases/$dbId/schemas/$schemaId/tables/$tableId',
            params: { serverId, dbId: database, schemaId: schema, tableId: table.name },
          })
        }
        actions={
          <IconBtn title="Drop Table" onClick={() => setDropOpen(true)} destructive>
            <Trash2 className="h-2.5 w-2.5" />
          </IconBtn>
        }
      />
      <ConfirmDropDialog
        open={dropOpen}
        onOpenChange={setDropOpen}
        title="Drop Table"
        description={`This will permanently drop table "${schema}.${table.name}". This cannot be undone.`}
        onConfirm={handleDrop}
      />
    </li>
  );
}


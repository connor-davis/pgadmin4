//////////////////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2026, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////////////////
import { useQuery } from '@tanstack/react-query';
import { Database, Layers, Server, Table2, Terminal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { rpc } from '@/lib/rpc';
import { useWorkspace } from '@/store/workspace';

interface SearchObjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SearchObjectItem = {
  id: string;
  kind: 'database' | 'schema' | 'server' | 'table';
  title: string;
  subtitle: string;
  searchText: string;
  serverId: string;
  database: string;
  schema?: string;
  table?: string;
};

const GROUP_ORDER: SearchObjectItem['kind'][] = [
  'server',
  'database',
  'schema',
  'table',
];

const GROUP_LABELS: Record<SearchObjectItem['kind'], string> = {
  server: 'Servers',
  database: 'Databases',
  schema: 'Schemas',
  table: 'Tables',
};

export function SearchObjectsDialog({
  open,
  onOpenChange,
}: SearchObjectsDialogProps) {
  const [query, setQuery] = useState('');
  const { openQueryTool, openScript } = useWorkspace();

  const {
    data = [],
    error,
    isLoading,
  } = useQuery({
    queryKey: ['search-objects-index'],
    enabled: open,
    staleTime: 60_000,
    queryFn: async (): Promise<SearchObjectItem[]> => {
      const servers = await rpc.listServers();

      const indexedServers = await Promise.all(
        servers.map(async (server) => {
          const databases = await rpc.getDatabases(server.id);

          const indexedDatabases = await Promise.all(
            databases.map(async (database) => {
              const schemas = await rpc.getSchemas(server.id, database.name);

              const tableEntries = await Promise.all(
                schemas.map(async (schema) => {
                  const tables = await rpc.getTables(
                    server.id,
                    database.name,
                    schema.name
                  );

                  return tables.map((table) => ({
                    id: `table:${server.id}:${database.name}:${schema.name}:${table.name}`,
                    kind: 'table' as const,
                    title: `${schema.name}.${table.name}`,
                    subtitle: `${database.name} • ${server.name}`,
                    searchText: [
                      server.name,
                      server.host,
                      database.name,
                      schema.name,
                      table.name,
                      table.type,
                    ]
                      .join(' ')
                      .toLowerCase(),
                    serverId: server.id,
                    database: database.name,
                    schema: schema.name,
                    table: table.name,
                  }));
                })
              );

              return [
                {
                  id: `database:${server.id}:${database.name}`,
                  kind: 'database' as const,
                  title: database.name,
                  subtitle: `${server.name} • owner ${database.owner}`,
                  searchText: [
                    server.name,
                    server.host,
                    database.name,
                    database.owner,
                  ]
                    .join(' ')
                    .toLowerCase(),
                  serverId: server.id,
                  database: database.name,
                },
                ...schemas.map((schema) => ({
                  id: `schema:${server.id}:${database.name}:${schema.name}`,
                  kind: 'schema' as const,
                  title: `${database.name}.${schema.name}`,
                  subtitle: `${server.name} • owner ${schema.owner}`,
                  searchText: [
                    server.name,
                    database.name,
                    schema.name,
                    schema.owner,
                  ]
                    .join(' ')
                    .toLowerCase(),
                  serverId: server.id,
                  database: database.name,
                  schema: schema.name,
                })),
                ...tableEntries.flat(),
              ];
            })
          );

          return [
            {
              id: `server:${server.id}`,
              kind: 'server' as const,
              title: server.name,
              subtitle: `${server.host}:${server.port} • default ${server.database}`,
              searchText: [
                server.name,
                server.host,
                server.port,
                server.database,
              ]
                .join(' ')
                .toLowerCase(),
              serverId: server.id,
              database: server.database,
            },
            ...indexedDatabases.flat(),
          ];
        })
      );

      return indexedServers.flat();
    },
  });

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return data.slice(0, 50);
    }

    return data
      .filter((item) => item.searchText.includes(normalizedQuery))
      .slice(0, 100);
  }, [data, query]);

  const grouped = useMemo(
    () =>
      GROUP_ORDER.map((kind) => ({
        kind,
        items: filtered.filter((item) => item.kind === kind),
      })).filter((group) => group.items.length > 0),
    [filtered]
  );

  function handleSelect(item: SearchObjectItem) {
    if (item.kind === 'table' && item.schema && item.table) {
      openScript(
        item.serverId,
        item.database,
        `${item.schema}.${item.table}`,
        `SELECT *\nFROM "${item.schema}"."${item.table}"\nLIMIT 100;`
      );
    } else if (item.kind === 'schema' && item.schema) {
      openScript(
        item.serverId,
        item.database,
        `Set search path ${item.schema}`,
        `SET search_path TO "${item.schema}";`
      );
    } else {
      openQueryTool(item.serverId, item.database);
    }

    onOpenChange(false);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search objects"
      description="Search across configured servers, databases, schemas, and tables."
      className="sm:max-w-2xl"
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search objects..."
        />
        <CommandList>
          {!isLoading && !error && filtered.length === 0 && (
            <CommandEmpty>No matching objects found.</CommandEmpty>
          )}

          {isLoading && (
            <div className="px-3 py-6 text-sm text-muted-foreground">
              Building object index...
            </div>
          )}

          {error && (
            <div className="px-3 py-6 text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : 'Failed to search objects.'}
            </div>
          )}

          {!isLoading &&
            !error &&
            grouped.map((group) => (
              <CommandGroup key={group.kind} heading={GROUP_LABELS[group.kind]}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.searchText}
                    onSelect={() => handleSelect(item)}
                  >
                    {item.kind === 'server' && <Server className="h-4 w-4" />}
                    {item.kind === 'database' && (
                      <Database className="h-4 w-4" />
                    )}
                    {item.kind === 'schema' && <Layers className="h-4 w-4" />}
                    {item.kind === 'table' && <Table2 className="h-4 w-4" />}
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{item.title}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {item.subtitle}
                      </span>
                    </div>
                    <CommandShortcut>
                      {item.kind === 'table' || item.kind === 'schema' ? (
                        <Terminal className="h-3.5 w-3.5" />
                      ) : (
                        'Open'
                      )}
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

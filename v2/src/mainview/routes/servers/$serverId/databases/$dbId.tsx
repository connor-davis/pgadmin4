import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Database, Layers, Loader2, Server, Terminal } from 'lucide-react';
import { useState } from 'react';

import { CreateSchemaDialog } from '@/components/pgadmin/dialogs/CreateSchemaDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { queryKeys, rpc } from '@/lib/rpc';

export const Route = createFileRoute('/servers/$serverId/databases/$dbId')({
  component: DatabasePage,
});

function DatabasePage() {
  const { serverId, dbId } = Route.useParams();
  const navigate = useNavigate();
  const [createSchemaOpen, setCreateSchemaOpen] = useState(false);
  const [activeSchema, setActiveSchema] = useState<string | null>(null);

  const { data: server, isLoading: serverLoading } = useQuery({
    queryKey: queryKeys.server(serverId),
    queryFn: () =>
      rpc.listServers().then((s) => s.find((x) => x.id === serverId)),
    enabled: Boolean(serverId),
  });

  const { data: schemas = [], isLoading: schemasLoading } = useQuery({
    queryKey: queryKeys.schemas(serverId, dbId),
    queryFn: () => rpc.getSchemas(serverId, dbId),
    enabled: Boolean(serverId) && Boolean(dbId),
  });

  const { data: tables = [], isLoading: tablesLoading } = useQuery({
    queryKey: queryKeys.tables(serverId, dbId, activeSchema ?? ''),
    queryFn: () => rpc.getTables(serverId, dbId, activeSchema!),
    enabled: Boolean(activeSchema),
  });

  if (serverLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Database className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate">{dbId}</h1>
            {server && (
              <p className="text-xs text-muted-foreground">
                <Server className="h-3 w-3 inline mr-1" />
                {server.name} · {server.host}:{server.port}
                {server.ssl && <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">SSL</Badge>}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateSchemaOpen(true)}
          >
            <Layers className="h-3.5 w-3.5 mr-1" />
            New Schema
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate({
                to: '/servers/$serverId/databases/$dbId/query',
                params: { serverId, dbId },
              })
            }
          >
            <Terminal className="h-3.5 w-3.5 mr-1" />
            Query Tool
          </Button>
        </div>
      </div>

      {/* Schemas + Tables panel */}
      <div className="flex flex-1 overflow-hidden divide-x divide-border">
        {/* Schemas list */}
        <div className="w-48 shrink-0 overflow-y-auto p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Schemas ({schemas.length})
          </h2>
          {schemasLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <ul className="space-y-0.5">
              {schemas.map((schema) => (
                <li key={schema.name}>
                  <button
                    className={`w-full rounded px-2 py-1 text-left text-sm transition-colors hover:bg-accent ${
                      activeSchema === schema.name
                        ? 'bg-accent font-medium'
                        : 'text-foreground'
                    }`}
                    onClick={() => setActiveSchema(schema.name)}
                  >
                    {schema.name}
                  </button>
                </li>
              ))}
              {schemas.length === 0 && (
                <li className="text-xs text-muted-foreground">No schemas found.</li>
              )}
            </ul>
          )}
        </div>

        {/* Tables panel */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeSchema ? (
            <>
              <h2 className="mb-3 text-sm font-medium">
                {activeSchema} — Tables &amp; Views
              </h2>
              {tablesLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {tables.map((t) => (
                    <button
                      key={`${t.schema}.${t.name}`}
                      className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-left hover:border-primary/50 transition-colors"
                      onClick={() =>
                        navigate({
                          to: '/servers/$serverId/databases/$dbId/schemas/$schemaId/tables/$tableId',
                          params: {
                            serverId,
                            dbId,
                            schemaId: t.schema,
                            tableId: t.name,
                          },
                        })
                      }
                    >
                      <Database className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.type}</p>
                      </div>
                    </button>
                  ))}
                  {tables.length === 0 && (
                    <p className="col-span-full text-sm text-muted-foreground">
                      No tables or views in this schema.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a schema on the left to browse its tables.
            </p>
          )}
        </div>
      </div>

      <CreateSchemaDialog
        open={createSchemaOpen}
        onOpenChange={setCreateSchemaOpen}
        serverId={serverId}
        database={dbId}
      />
    </div>
  );
}

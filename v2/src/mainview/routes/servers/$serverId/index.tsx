import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { Database, Loader2, Server } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { queryKeys, rpc } from '@/lib/rpc';

export const Route = createFileRoute('/servers/$serverId/')({
  component: ServerPage,
});

function ServerPage() {
  const { serverId } = Route.useParams();

  const { data: server, isLoading: serverLoading } = useQuery({
    queryKey: queryKeys.server(serverId),
    queryFn: () =>
      rpc.listServers().then((s) => s.find((x) => x.id === serverId)),
    enabled: Boolean(serverId),
  });

  const { data: databases = [], isLoading: dbLoading } = useQuery({
    queryKey: queryKeys.databases(serverId),
    queryFn: () => rpc.getDatabases(serverId),
    enabled: Boolean(serverId),
  });

  if (serverLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!server) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Server not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <Server className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">{server.name}</h1>
        {server.ssl && <Badge variant="outline">SSL</Badge>}
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        {server.host}:{server.port} · {server.username}
      </p>

      <h2 className="mb-3 text-sm font-medium">Databases</h2>
      {dbLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {databases.map((db) => (
            <Link
              key={db.name}
              to="/servers/$serverId/databases/$dbId"
              params={{ serverId, dbId: db.name }}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-primary/50 transition-colors"
            >
              <Database className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate font-medium">{db.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {db.owner}
                </p>
              </div>
            </Link>
          ))}
          {databases.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              No databases found.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

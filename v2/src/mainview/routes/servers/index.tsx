import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { Loader2, Plus, Server } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type ServerConfig, queryKeys, rpc } from '@/lib/rpc';

export const Route = createFileRoute('/servers/')({
  component: ServersPage,
});

type ServerFormData = Omit<ServerConfig, 'id'>;

const DEFAULT_FORM: ServerFormData = {
  name: '',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: '',
  database: 'postgres',
  ssl: false,
};

function AddServerDialog({ onAdded }: { onAdded?: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ServerFormData>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: rpc.addServer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servers() });
      setOpen(false);
      setForm(DEFAULT_FORM);
      setError(null);
      onAdded?.();
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to add server');
    },
  });

  function field(key: keyof ServerFormData) {
    return {
      value: String(form[key]),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({
          ...f,
          [key]: key === 'port' ? Number(e.target.value) : e.target.value,
        })),
    };
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="h-3.5 w-3.5" />
        Add Server
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Server</DialogTitle>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            mutation.mutate(form);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="srv-name">Display Name</Label>
            <Input
              id="srv-name"
              placeholder="My PostgreSQL"
              required
              {...field('name')}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="srv-host">Host</Label>
              <Input
                id="srv-host"
                placeholder="localhost"
                required
                {...field('host')}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="srv-port">Port</Label>
              <Input
                id="srv-port"
                type="number"
                min={1}
                max={65535}
                required
                {...field('port')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="srv-user">Username</Label>
              <Input
                id="srv-user"
                placeholder="postgres"
                required
                {...field('username')}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="srv-pass">Password</Label>
              <Input
                id="srv-pass"
                type="password"
                autoComplete="current-password"
                {...field('password')}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="srv-db">Default Database</Label>
            <Input
              id="srv-db"
              placeholder="postgres"
              required
              {...field('database')}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="srv-ssl"
              type="checkbox"
              checked={form.ssl}
              onChange={(e) =>
                setForm((f) => ({ ...f, ssl: e.target.checked }))
              }
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="srv-ssl">SSL / TLS</Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Connect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ServersPage() {
  const { data: servers = [], isLoading } = useQuery({
    queryKey: queryKeys.servers(),
    queryFn: rpc.listServers,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Servers</h1>
        <AddServerDialog />
      </div>

      {servers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No servers configured. Click "Add Server" to connect to a PostgreSQL
          instance.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => (
            <Link
              key={server.id}
              to="/servers/$serverId"
              params={{ serverId: server.id }}
              className="block rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors"
            >
              <div className="mb-1 flex items-center gap-2">
                <Server className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-medium text-card-foreground">
                  {server.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {server.host}:{server.port} / {server.database}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {server.username}
                {server.ssl && (
                  <Badge
                    variant="outline"
                    className="ml-2 text-[10px] px-1 py-0"
                  >
                    SSL
                  </Badge>
                )}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

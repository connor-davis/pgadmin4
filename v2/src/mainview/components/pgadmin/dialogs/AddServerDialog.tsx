import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { type ServerConfig, queryKeys, rpc } from '@/lib/rpc';

interface AddServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function AddServerDialog({ open, onOpenChange }: AddServerDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ServerFormData>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: rpc.addServer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servers() });
      onOpenChange(false);
      setForm(DEFAULT_FORM);
      setError(null);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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

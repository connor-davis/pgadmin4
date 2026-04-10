import { createRootRoute } from '@tanstack/react-router';

import { Toaster } from 'sonner';

import { AppShell } from '@/components/layout/AppShell';
import { WorkspaceProvider } from '@/store/workspace';

function Root() {
  return (
    <WorkspaceProvider>
      <AppShell />
      <Toaster position="bottom-right" richColors />
    </WorkspaceProvider>
  );
}

export const Route = createRootRoute({
  component: Root,
});

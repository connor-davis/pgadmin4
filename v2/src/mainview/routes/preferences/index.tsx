import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/preferences/')({
  component: PreferencesPage,
});

function PreferencesPage() {
  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Preferences</h1>
      <p className="text-sm text-muted-foreground">
        Preferences configuration coming soon.
      </p>
    </div>
  );
}

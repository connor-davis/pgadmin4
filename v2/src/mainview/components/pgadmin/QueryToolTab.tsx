import {
  ChevronDown,
  Download,
  Eraser,
  Play,
  Save,
  Square,
  Upload,
} from 'lucide-react';
import { useCallback, useState } from 'react';

import { ResultsPanel } from '@/components/pgadmin/ResultsPanel';
import { SqlEditor } from '@/components/pgadmin/SqlEditor';
import { Button } from '@/components/ui/button';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { type QueryResult, rpc } from '@/lib/rpc';
import { cn } from '@/lib/utils';

interface QueryToolTabProps {
  serverId: string;
  database: string;
  initialSql?: string;
}

export function QueryToolTab({ serverId, database, initialSql }: QueryToolTabProps) {
  const [sql, setSql] = useState(initialSql ?? '');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runQuery = useCallback(async () => {
    const query = sql.trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await rpc.executeQuery(serverId, database, query);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setLoading(false);
    }
  }, [sql, serverId, database]);

  const canRun =
    Boolean(sql.trim()) && !loading && Boolean(serverId) && Boolean(database);

  return (
    <div className="flex h-full flex-col">
      {/* Connection breadcrumb */}
      {serverId && database && (
        <div className="flex shrink-0 items-center gap-1 border-b border-border bg-muted/20 px-3 py-0.5 text-xs text-muted-foreground">
          <span>{serverId}</span>
          <span>/</span>
          <span className="text-foreground font-medium">{database}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-background px-2 py-1">
        <ToolbarButton
          icon={<Upload className="h-3.5 w-3.5" />}
          title="Open File"
          disabled
        />
        <ToolbarButton
          icon={<Save className="h-3.5 w-3.5" />}
          title="Save File"
          disabled
        />
        <ToolbarSeparator />
        <ToolbarButton
          icon={<Play className="h-3.5 w-3.5 text-green-600" />}
          title="Execute / Refresh (F5)"
          onClick={runQuery}
          disabled={!canRun}
        />
        <ToolbarButton
          icon={<Square className="h-3.5 w-3.5 text-destructive" />}
          title="Stop"
          disabled={!loading}
          onClick={() => {}}
        />
        <ToolbarSeparator />
        <ToolbarButton
          icon={<Eraser className="h-3.5 w-3.5" />}
          title="Clear editor"
          onClick={() => {
            setSql('');
            setResult(null);
            setError(null);
          }}
          disabled={!sql}
        />
        <ToolbarSeparator />
        <ToolbarButton
          icon={<Download className="h-3.5 w-3.5" />}
          title="Download results as CSV"
          disabled={!result || result.columns.length === 0}
          onClick={() => downloadCsv(result)}
        />
        {/* Row limit selector */}
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <span>Rows:</span>
          <button className="flex items-center gap-0.5 rounded border border-border bg-background px-2 py-0.5 text-xs hover:bg-muted">
            100 <ChevronDown className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      {/* Split: editor + results */}
      <ResizablePanelGroup orientation="vertical" className="flex-1">
        <ResizablePanel defaultSize={55} minSize={20}>
          <SqlEditor
            value={sql}
            onChange={setSql}
            onExecute={runQuery}
            className="h-full"
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={45} minSize={15}>
          <ResultsPanel result={result} error={error} loading={loading} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

// ─── Toolbar helpers ──────────────────────────────────────────────────────────

function ToolbarButton({
  icon,
  title,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn('h-6 w-6 rounded', disabled && 'opacity-40 cursor-default')}
    >
      {icon}
    </Button>
  );
}

function ToolbarSeparator() {
  return <div className="mx-0.5 h-4 w-px bg-border" />;
}

// ─── CSV download ─────────────────────────────────────────────────────────────

function downloadCsv(result: QueryResult | null) {
  if (!result) return;
  const header = result.columns.join(',');
  const rows = result.rows.map((row) =>
    row
      .map((cell) => {
        if (cell === null) return '';
        const s = String(cell);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      })
      .join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'query-results.csv';
  a.click();
  URL.revokeObjectURL(url);
}

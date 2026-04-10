import { createFileRoute } from '@tanstack/react-router';
import { Loader2, Play } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { type QueryResult, rpc } from '@/lib/rpc';

export const Route = createFileRoute(
  '/servers/$serverId/databases/$dbId/query'
)({
  component: QueryToolPage,
});

function QueryToolPage() {
  const { serverId, dbId } = Route.useParams();
  const [sql, setSql] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const runQuery = useCallback(async () => {
    const query = sql.trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await rpc.executeQuery(serverId, dbId, query);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setLoading(false);
    }
  }, [sql, serverId, dbId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold">Query Tool</h1>
          <p className="text-xs text-muted-foreground">{dbId}</p>
        </div>
        <Button size="sm" onClick={runQuery} disabled={loading || !sql.trim()}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5 mr-1" />
          )}
          Run (Ctrl+Enter)
        </Button>
      </div>

      {/* Editor */}
      <div className="p-3 border-b border-border shrink-0">
        <Textarea
          ref={textareaRef}
          className="font-mono text-xs min-h-32 resize-y"
          placeholder="SELECT * FROM my_schema.my_table LIMIT 10;"
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="m-4 rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">Error</p>
            <p className="mt-1 text-xs font-mono text-destructive/80 whitespace-pre-wrap">
              {error}
            </p>
          </div>
        )}

        {result && (
          <div>
            <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/40 border-b border-border">
              {result.rowCount} row{result.rowCount !== 1 ? 's' : ''} returned
            </div>
            {result.columns.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    {result.columns.map((col) => (
                      <TableHead key={col}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row, i) => (
                    <TableRow key={i}>
                      {row.map((cell, j) => (
                        <TableCell key={j} className="text-xs font-mono">
                          {cell === null ? (
                            <span className="text-muted-foreground italic">
                              NULL
                            </span>
                          ) : (
                            String(cell)
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                Query executed successfully. No rows returned.
              </p>
            )}
          </div>
        )}

        {!error && !result && !loading && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Enter a SQL query above and press Run or Ctrl+Enter.
          </p>
        )}
      </div>
    </div>
  );
}

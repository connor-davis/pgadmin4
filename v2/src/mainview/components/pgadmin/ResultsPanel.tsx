import { useState } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type QueryResult } from '@/lib/rpc';
import { cn } from '@/lib/utils';

interface ResultsPanelProps {
  result: QueryResult | null;
  error: string | null;
  loading: boolean;
  messages?: string[];
}

type ResultTab = 'data' | 'messages' | 'notifications';

export function ResultsPanel({
  result,
  error,
  loading,
  messages = [],
}: ResultsPanelProps) {
  const [activeTab, setActiveTab] = useState<ResultTab>('data');

  const tabs: { id: ResultTab; label: string }[] = [
    { id: 'data', label: 'Data Output' },
    { id: 'messages', label: 'Messages' },
    { id: 'notifications', label: 'Notifications' },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Tab strip */}
      <div className="flex shrink-0 items-center border-b border-border bg-muted/20 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-3 py-1 text-xs border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-primary text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
        {result && (
          <span className="ml-auto text-xs text-muted-foreground pr-2">
            {result.rowCount} row{result.rowCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'data' && (
          <>
            {loading && (
              <div className="flex h-full items-center justify-center">
                <span className="text-xs text-muted-foreground animate-pulse">
                  Executing…
                </span>
              </div>
            )}
            {!loading && error && (
              <div className="m-3 rounded border border-destructive/40 bg-destructive/10 p-3">
                <p className="text-xs font-medium text-destructive">Error</p>
                <pre className="mt-1 text-xs font-mono text-destructive/80 whitespace-pre-wrap">
                  {error}
                </pre>
              </div>
            )}
            {!loading && !error && result && result.columns.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 text-center text-muted-foreground font-normal text-xs">
                      #
                    </TableHead>
                    {result.columns.map((col) => (
                      <TableHead key={col} className="text-xs font-semibold">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {i + 1}
                      </TableCell>
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
            )}
            {!loading && !error && result && result.columns.length === 0 && (
              <p className="p-4 text-xs text-muted-foreground">
                Query executed successfully. No rows returned.
              </p>
            )}
            {!loading && !error && !result && (
              <p className="p-4 text-xs text-muted-foreground">
                Execute a query to see results here.
              </p>
            )}
          </>
        )}

        {activeTab === 'messages' && (
          <pre className="p-3 text-xs font-mono text-foreground whitespace-pre-wrap">
            {error
              ? `ERROR:  ${error}`
              : messages.length > 0
                ? messages.join('\n')
                : result
                  ? `Query returned ${result.rowCount} row(s).`
                  : 'No messages.'}
          </pre>
        )}

        {activeTab === 'notifications' && (
          <p className="p-4 text-xs text-muted-foreground">No notifications.</p>
        )}
      </div>
    </div>
  );
}

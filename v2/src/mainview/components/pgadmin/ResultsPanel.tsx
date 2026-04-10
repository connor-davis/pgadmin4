//////////////////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2026, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////////////////
import { useEffect, useMemo, useState } from 'react';

import { ResultPagination } from '@/components/pgadmin/ResultPagination';
import { ResultTable } from '@/components/pgadmin/ResultTable';
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const tabs: { id: ResultTab; label: string }[] = [
    { id: 'data', label: 'Data Output' },
    { id: 'messages', label: 'Messages' },
    { id: 'notifications', label: 'Notifications' },
  ];

  const totalRowCount = result?.rows.length ?? 0;
  const pageCount =
    totalRowCount === 0 ? 1 : Math.ceil(totalRowCount / pageSize);
  const currentPage = Math.max(1, Math.min(page, pageCount));
  const rowOffset = (currentPage - 1) * pageSize;

  const pagedRows = useMemo(
    () => result?.rows.slice(rowOffset, rowOffset + pageSize) ?? [],
    [pageSize, result?.rows, rowOffset]
  );

  useEffect(() => {
    setPage(1);
  }, [pageSize, result]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center border-b border-border bg-muted/20 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'border-b-2 px-3 py-1 text-xs transition-colors',
              activeTab === tab.id
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
        {result && (
          <span className="ml-auto pr-2 text-xs text-muted-foreground">
            {totalRowCount} row{totalRowCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === 'data' && (
          <div className="flex h-full flex-col">
            {loading && (
              <div className="flex h-full items-center justify-center">
                <span className="animate-pulse text-xs text-muted-foreground">
                  Executing…
                </span>
              </div>
            )}
            {!loading && error && (
              <div className="m-3 rounded border border-destructive/40 bg-destructive/10 p-3">
                <p className="text-xs font-medium text-destructive">Error</p>
                <pre className="mt-1 whitespace-pre-wrap text-xs font-mono text-destructive/80">
                  {error}
                </pre>
              </div>
            )}
            {!loading && !error && result && result.columns.length > 0 && (
              <>
                <div className="min-h-0 flex-1">
                  <ResultTable
                    columns={result.columns}
                    rows={pagedRows}
                    rowOffset={rowOffset}
                    showRowNumbers
                  />
                </div>
                <ResultPagination
                  page={currentPage}
                  pageCount={pageCount}
                  pageSize={pageSize}
                  totalRowCount={totalRowCount}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </>
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
          </div>
        )}

        {activeTab === 'messages' && (
          <pre className="p-3 text-xs font-mono whitespace-pre-wrap text-foreground">
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

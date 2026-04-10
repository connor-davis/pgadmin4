import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  ChevronDown,
  Filter,
  Loader2,
  Plus,
  Scissors,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { AddColumnDialog } from '@/components/pgadmin/dialogs/AddColumnDialog';
import { ConfirmDropDialog } from '@/components/pgadmin/dialogs/ConfirmDropDialog';
import { TruncateTableDialog } from '@/components/pgadmin/dialogs/TruncateTableDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ResultPagination } from '@/components/pgadmin/ResultPagination';
import { ResultTable } from '@/components/pgadmin/ResultTable';
import { queryKeys, rpc } from '@/lib/rpc';

export const Route = createFileRoute(
  '/servers/$serverId/databases/$dbId/schemas/$schemaId/tables/$tableId'
)({
  component: TableDetailPage,
});

type RowMode = 'first' | 'last' | 'all' | 'filtered';
type TruncateMode = 'plain' | 'cascade' | 'restart' | 'cascade_restart';

const ROW_MODE_LABELS: Record<RowMode, string> = {
  first: 'First 100 Rows',
  last: 'Last 100 Rows',
  all: 'All Rows',
  filtered: 'Filtered Rows',
};

function TableDetailPage() {
  const { serverId, dbId, schemaId, tableId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Drop
  const [dropOpen, setDropOpen] = useState(false);
  const [dropCascade, setDropCascade] = useState(false);

  // Truncate
  const [truncateOpen, setTruncateOpen] = useState(false);
  const [truncateMode, setTruncateMode] = useState<TruncateMode>('plain');

  // Add Column
  const [addColumnOpen, setAddColumnOpen] = useState(false);

  // View Data mode
  const [rowMode, setRowMode] = useState<RowMode>('first');
  const [filterText, setFilterText] = useState('');
  const [appliedFilter, setAppliedFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const { data: columns = [], isLoading: colsLoading } = useQuery({
    queryKey: queryKeys.columns(serverId, dbId, schemaId, tableId),
    queryFn: () => rpc.getColumns(serverId, dbId, schemaId, tableId),
  });

  const { data: tableData, isLoading: dataLoading } = useQuery({
    queryKey: [
      ...queryKeys.tableData(serverId, dbId, schemaId, tableId),
      rowMode,
      appliedFilter,
      page,
      pageSize,
    ],
    queryFn: () =>
      rpc.getTableData(serverId, dbId, schemaId, tableId, {
        page,
        pageSize,
        rowMode,
        filter: rowMode === 'filtered' ? appliedFilter : undefined,
      }),
  });

  async function handleDrop() {
    await rpc.dropTable(serverId, dbId, schemaId, tableId, dropCascade);
    await queryClient.invalidateQueries({
      queryKey: queryKeys.tables(serverId, dbId, schemaId),
    });
    navigate({
      to: '/servers/$serverId/databases/$dbId',
      params: { serverId, dbId },
    });
  }

  function openTruncate(mode: TruncateMode) {
    setTruncateMode(mode);
    setTruncateOpen(true);
  }

  function openDrop(cascade: boolean) {
    setDropCascade(cascade);
    setDropOpen(true);
  }

  function applyFilter() {
    setAppliedFilter(filterText);
    setPage(1);
  }

  useEffect(() => {
    setPage(1);
  }, [pageSize, rowMode]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate({
              to: '/servers/$serverId/databases/$dbId',
              params: { serverId, dbId },
            })
          }
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">
            {schemaId}.{tableId}
          </h1>
          <p className="text-xs text-muted-foreground">{dbId}</p>
        </div>

        {/* Truncate dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground h-8">
            <Scissors className="h-3.5 w-3.5" />
            Truncate
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openTruncate('plain')}>
              Truncate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openTruncate('cascade')}>
              Truncate Cascade
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openTruncate('restart')}>
              Truncate Restart Identity
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Drop dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1 text-sm font-medium text-destructive-foreground shadow-xs hover:bg-destructive/90 h-8">
            <Trash2 className="h-3.5 w-3.5" />
            Drop
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => openDrop(false)}
            >
              Drop
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => openDrop(true)}
            >
              Drop (Cascade)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden divide-y divide-border">
        {/* Columns panel */}
        <div className="shrink-0 max-h-72 overflow-hidden">
          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40 flex items-center justify-between">
            <span>Columns ({columns.length})</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setAddColumnOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Column
            </Button>
          </div>
          {colsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ResultTable
              columns={['Name', 'Type', 'Nullable', 'Default']}
              rows={columns.map((col) => [
                col.name,
                col.type,
                col.nullable ? 'YES' : 'NO',
                col.defaultValue ?? '',
              ])}
            />
          )}
        </div>

        {/* Data panel */}
        <div className="flex-1 overflow-auto flex flex-col">
          {/* View data toolbar */}
          <div className="px-4 py-2 bg-muted/40 flex items-center gap-2 flex-wrap shrink-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mr-1">
              View Data{tableData ? ` (${tableData.totalRowCount} rows)` : ''}
            </span>
            {(['first', 'last', 'all', 'filtered'] as RowMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setRowMode(mode)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                  rowMode === mode
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border bg-background hover:bg-accent'
                }`}
              >
                {ROW_MODE_LABELS[mode]}
              </button>
            ))}
            {rowMode === 'filtered' && (
              <div className="flex items-center gap-1 mt-1 w-full">
                <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Input
                  className="h-7 text-xs flex-1"
                  placeholder="WHERE clause, e.g. id > 100 AND status = 'active'"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
                />
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={applyFilter}
                >
                  Apply
                </Button>
              </div>
            )}
          </div>

          {/* Data table */}
          <div className="min-h-0 flex-1">
            {dataLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : tableData && tableData.columns.length > 0 ? (
              <>
                <ResultTable
                  columns={tableData.columns}
                  rows={tableData.rows}
                  rowOffset={(tableData.page - 1) * tableData.pageSize}
                />
                <ResultPagination
                  page={tableData.page}
                  pageCount={tableData.pageCount}
                  pageSize={tableData.pageSize}
                  totalRowCount={tableData.totalRowCount}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </>
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                No data in this table.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ConfirmDropDialog
        open={dropOpen}
        onOpenChange={setDropOpen}
        title={dropCascade ? 'Drop Table (Cascade)' : 'Drop Table'}
        description={
          dropCascade
            ? `This will permanently drop "${schemaId}.${tableId}" and all dependent objects. This cannot be undone.`
            : `This will permanently drop table "${schemaId}.${tableId}" and all its data. This cannot be undone.`
        }
        onConfirm={handleDrop}
      />

      <TruncateTableDialog
        open={truncateOpen}
        onOpenChange={setTruncateOpen}
        serverId={serverId}
        database={dbId}
        schema={schemaId}
        table={tableId}
        initialMode={truncateMode}
      />

      <AddColumnDialog
        open={addColumnOpen}
        onOpenChange={setAddColumnOpen}
        serverId={serverId}
        database={dbId}
        schema={schemaId}
        table={tableId}
      />
    </div>
  );
}

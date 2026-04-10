import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { ConfirmDropDialog } from '@/components/pgadmin/dialogs/ConfirmDropDialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { queryKeys, rpc } from '@/lib/rpc';

export const Route = createFileRoute(
  '/servers/$serverId/databases/$dbId/schemas/$schemaId/tables/$tableId'
)({
  component: TableDetailPage,
});

function TableDetailPage() {
  const { serverId, dbId, schemaId, tableId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dropOpen, setDropOpen] = useState(false);

  const { data: columns = [], isLoading: colsLoading } = useQuery({
    queryKey: queryKeys.columns(serverId, dbId, schemaId, tableId),
    queryFn: () => rpc.getColumns(serverId, dbId, schemaId, tableId),
  });

  const { data: tableData, isLoading: dataLoading } = useQuery({
    queryKey: queryKeys.tableData(serverId, dbId, schemaId, tableId),
    queryFn: () => rpc.getTableData(serverId, dbId, schemaId, tableId, 100),
  });

  async function handleDrop() {
    await rpc.dropTable(serverId, dbId, schemaId, tableId, true);
    await queryClient.invalidateQueries({
      queryKey: queryKeys.tables(serverId, dbId, schemaId),
    });
    navigate({
      to: '/servers/$serverId/databases/$dbId',
      params: { serverId, dbId },
    });
  }

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
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDropOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Drop Table
        </Button>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden divide-y divide-border">
        {/* Columns panel */}
        <div className="shrink-0 max-h-48 overflow-y-auto">
          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40">
            Columns ({columns.length})
          </div>
          {colsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Nullable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {columns.map((col) => (
                  <TableRow key={col.name}>
                    <TableCell className="font-medium">{col.name}</TableCell>
                    <TableCell className="text-muted-foreground">{col.type}</TableCell>
                    <TableCell>{col.nullable ? 'YES' : 'NO'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Data preview */}
        <div className="flex-1 overflow-auto">
          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40">
            Data Preview{tableData ? ` (${tableData.rowCount} rows)` : ''}
          </div>
          {dataLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : tableData && tableData.columns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {tableData.columns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.rows.map((row, i) => (
                  <TableRow key={i}>
                    {row.map((cell, j) => (
                      <TableCell key={j} className="text-xs font-mono">
                        {cell === null ? (
                          <span className="text-muted-foreground italic">NULL</span>
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
              No data in this table.
            </p>
          )}
        </div>
      </div>

      <ConfirmDropDialog
        open={dropOpen}
        onOpenChange={setDropOpen}
        title="Drop Table"
        description={`This will permanently drop table "${schemaId}.${tableId}" and all its data. This cannot be undone.`}
        onConfirm={handleDrop}
      />
    </div>
  );
}

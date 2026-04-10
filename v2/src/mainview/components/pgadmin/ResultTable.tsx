//////////////////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2026, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////////////////
import { ScrollArea } from '@/components/ui/scroll-area';

interface ResultTableProps {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  rowOffset?: number;
  showRowNumbers?: boolean;
}

export function ResultTable({
  columns,
  rows,
  rowOffset = 0,
  showRowNumbers = false,
}: ResultTableProps) {
  return (
    <ScrollArea className="h-full w-full" scrollbars="both">
      <table className="min-w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_hsl(var(--border))]">
          <tr className="border-b">
            {showRowNumbers && (
              <th className="h-10 px-2 text-center text-xs font-normal whitespace-nowrap text-muted-foreground">
                #
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column}
                className="h-10 px-2 text-left text-xs font-semibold whitespace-nowrap text-foreground"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={`${rowOffset}-${rowIndex}`}
              className="border-b transition-colors hover:bg-muted/50"
            >
              {showRowNumbers && (
                <td className="p-2 text-center text-xs whitespace-nowrap text-muted-foreground">
                  {rowOffset + rowIndex + 1}
                </td>
              )}
              {row.map((cell, cellIndex) => (
                <td
                  key={`${rowOffset}-${rowIndex}-${cellIndex}`}
                  className="p-2 font-mono text-xs whitespace-nowrap align-middle"
                >
                  {cell === null ? (
                    <span className="italic text-muted-foreground">NULL</span>
                  ) : (
                    String(cell)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}

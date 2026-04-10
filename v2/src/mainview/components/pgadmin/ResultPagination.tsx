//////////////////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2026, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////////////////
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ResultPaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  totalRowCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

const PAGE_SIZES = [25, 50, 100, 250, 500];

export function ResultPagination({
  page,
  pageCount,
  pageSize,
  totalRowCount,
  onPageChange,
  onPageSizeChange,
}: ResultPaginationProps) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-background px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {totalRowCount} row{totalRowCount === 1 ? '' : 's'}
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="mr-1 h-3.5 w-3.5" />
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {page} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
        >
          Next
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

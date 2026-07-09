"use client";

import * as React from "react";
import { Download, FileText, Sheet } from "lucide-react";
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

export interface ExportButtonProps {
  /** Triggered when user picks PDF export. Wire to a server action or jsPDF. */
  onExportPdf?: () => void | Promise<void>;
  /** Triggered when user picks CSV export. */
  onExportCsv?: () => void | Promise<void>;
  /** Label rendered on the trigger button. */
  label?: string;
  /** Disable the whole menu (e.g. while no rows are selected). */
  disabled?: boolean;
}

/**
 * Export menu stub. The actual PDF/CSV generation is delegated to the
 * consuming app so the UI package stays free of heavy formatting deps.
 */
export function ExportButton({
  onExportPdf,
  onExportCsv,
  label = "Export",
  disabled = false,
}: ExportButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export laporan</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void onExportPdf?.();
          }}
        >
          <FileText className="mr-2 h-4 w-4" />
          PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void onExportCsv?.();
          }}
        >
          <Sheet className="mr-2 h-4 w-4" />
          CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
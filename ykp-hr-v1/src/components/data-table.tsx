/**
 * Generic data table with consistent styling. Use for simple read-only lists.
 * For tables with row actions / inline edits, prefer a dedicated component.
 *
 * Server-renderable: pure presentation, no client-side state, no functions
 * passed in. Caller is responsible for any client interactivity (wrap with
 * a client component, or add it as a row subcomponent).
 */
import * as React from "react";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T, idx: number) => React.ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
}

export function DataTable<T>({
  data,
  columns,
  empty,
  rowKey
}: {
  data: T[];
  columns: Column<T>[];
  empty?: React.ReactNode;
  rowKey: (row: T, idx: number) => string;
}) {
  if (data.length === 0) {
    return (
      <div className="text-sm text-slate-500 py-4 text-center">
        {empty ?? "Belum ada data."}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 ${
                  c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
                }`}
                style={c.width ? { width: c.width } : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {data.map((row, idx) => (
            <tr key={rowKey(row, idx)} className="hover:bg-slate-50">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-2 ${
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {c.render(row, idx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
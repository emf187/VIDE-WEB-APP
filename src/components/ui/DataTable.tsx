import type { ReactNode } from "react";

export interface Column<T> {
  header: string;
  cell: (row: T, index: number) => ReactNode;
}

/** Plain data table: uppercase 9px headers, dashed row dividers. */
export function DataTable<T>({ columns, rows, rowKey }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T, index: number) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.header} className="border-b-2 border-line px-2 py-1.5 text-left text-[9px] font-normal tracking-[1.5px] text-dim2 uppercase">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)}>
              {columns.map((c) => (
                <td key={c.header} className="border-b border-dashed border-line p-2 align-top">
                  {c.cell(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

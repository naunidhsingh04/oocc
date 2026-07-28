"use client";

import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@oocc/ui";
import type { StackValue } from "@/lib/compiler/types";

export interface GlobalsTableProps {
  globals: Record<string, StackValue>;
}

function formatValue(value: StackValue): string {
  if (value.type === "bool") return value.value ? "true" : "false";
  return String(value.value);
}

export function GlobalsTable({ globals }: GlobalsTableProps) {
  const entries = Object.entries(globals);
  if (entries.length === 0) {
    return <div className="p-2 font-mono-label text-[11px] text-ink-soft">no globals yet</div>;
  }
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Value</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {entries.map(([name, value]) => (
          <TableRow key={name}>
            <TableCell className="font-mono-label text-[12px]">{name}</TableCell>
            <TableCell className="text-right font-mono-label text-[12px] tabular-nums">
              {formatValue(value)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

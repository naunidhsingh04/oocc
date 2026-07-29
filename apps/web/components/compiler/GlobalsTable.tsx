"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  const reduceMotion = useReducedMotion();
  if (entries.length === 0) {
    return <div className="p-3 font-mono-label text-[12px] text-ink-soft">no globals yet</div>;
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
        <AnimatePresence initial={false}>
          {entries.map(([name, value]) => (
            <motion.tr
              key={name}
              layout
              className="border-b border-rule last:border-b-0"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.16 }}
            >
              <TableCell className="font-mono-label text-[12px]">{name}</TableCell>
              <TableCell className="text-right font-mono-label text-[12px] tabular-nums">
                {formatValue(value)}
              </TableCell>
            </motion.tr>
          ))}
        </AnimatePresence>
      </TableBody>
    </Table>
  );
}

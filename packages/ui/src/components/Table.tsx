import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-auto">
      <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />
    </div>
  );
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-rule", className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-rule last:border-b-0", className)} {...props} />;
}

export function TableHeaderCell({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("px-3 py-2 font-body text-[12px] font-semibold text-ink-soft", className)} {...props} />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2 text-ink", className)} {...props} />;
}

"use client";

import { daysOverdue } from "@/lib/progress/reviewQueue";
import { masteryPercentLabel } from "@/lib/progress/mastery";
import { resolvePracticeTarget } from "@/lib/progress/weakConcepts";
import type { ConceptProgressView } from "@/lib/progress/types";
import { Chip, EmptyState, Panel, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@oocc/ui";
import Link from "next/link";

export interface ReviewQueueProps {
  queue: readonly ConceptProgressView[];
  now: Date;
}

/** Brief item 2: concepts due for review, most overdue first (already the
 * order `queue` arrives in — see `lib/progress/reviewQueue.ts` /
 * `apps/api/app/progress/review_queue.py`). */
export function ReviewQueue({ queue, now }: ReviewQueueProps) {
  return (
    <Panel title="Review queue" bodyClassName="min-h-[12rem]">
      {queue.length === 0 ? (
        <EmptyState title="Nothing due" description="Every concept you've touched is inside its review window." />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Concept</TableHeaderCell>
              <TableHeaderCell>Mastery</TableHeaderCell>
              <TableHeaderCell>Overdue</TableHeaderCell>
              <TableHeaderCell>Practice</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {queue.map((view) => {
              const target = resolvePracticeTarget(view.conceptId);
              const overdueDays = view.nextReviewAt ? daysOverdue(view.nextReviewAt, now) : 0;
              return (
                <TableRow key={view.conceptId}>
                  <TableCell>
                    <Chip channel={view.channel as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}>{view.title}</Chip>
                  </TableCell>
                  <TableCell className="font-mono-label text-[12px]">{masteryPercentLabel(view.mastery)}</TableCell>
                  <TableCell className="font-mono-label text-[12px]">
                    {overdueDays === 0 ? "due today" : `${overdueDays}d`}
                  </TableCell>
                  <TableCell>
                    {target ? (
                      <Link
                        href={target.kind === "curriculum" ? `/curriculum/${target.slug}` : `/problems/${target.slug}`}
                        className="font-mono-label text-[11px] uppercase tracking-[0.04em] text-signal hover:underline"
                      >
                        Practice this →
                      </Link>
                    ) : (
                      <span className="font-mono-label text-[11px] uppercase tracking-[0.04em] text-ink-soft">
                        No material yet
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

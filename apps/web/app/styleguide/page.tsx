"use client";

import {
  Button,
  Chip,
  type ChipChannel,
  EmptyState,
  IconButton,
  Panel,
  ResizableHandle,
  ResizablePane,
  ResizableSplit,
  SunIcon,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toast,
  ToastProvider,
  ToastViewport,
  Tooltip,
  TooltipProvider,
} from "@oocc/ui";
import { useState } from "react";

const CHANNELS: ChipChannel[] = [1, 2, 3, 4, 5, 6, 7, 8];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">{title}</h2>
        {description ? <p className="mt-1 font-body text-sm text-ink-soft">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ToastDemo() {
  const [open, setOpen] = useState(false);

  return (
    <ToastProvider>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Fire a toast
      </Button>
      <Toast
        open={open}
        onOpenChange={setOpen}
        tone="ok"
        title="Trace validated"
        description="All 12 fixtures matched trace.schema.json."
        duration={4000}
      />
      <ToastViewport />
    </ToastProvider>
  );
}

export default function StyleguidePage() {
  return (
    <TooltipProvider>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 p-8">
        <header className="flex flex-col gap-1 border-b border-rule pb-4">
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">Styleguide</h1>
          <p className="font-body text-sm text-ink-soft">
            docs/PRD.md §6.2 tokens and the Phase 0 primitive set. Toggle light/dark from the top bar — every
            component below repaints from the same tokens, no per-component dark-mode logic.
          </p>
        </header>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="primary" size="sm">
              Primary / sm
            </Button>
            <Button variant="secondary" disabled>
              Disabled
            </Button>
          </div>
        </Section>

        <Section title="Icon buttons + tooltips">
          <div className="flex items-center gap-2">
            <Tooltip content="Light mode">
              <IconButton aria-label="Light mode">
                <SunIcon />
              </IconButton>
            </Tooltip>
            <Tooltip content="Active state">
              <IconButton aria-label="Active example" active>
                <SunIcon />
              </IconButton>
            </Tooltip>
          </div>
        </Section>

        <Section title="Chips" description="Semantic tones, and the eight stable channel colors (docs/PRD.md §6.2).">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="neutral">Neutral</Chip>
            <Chip tone="signal">Signal</Chip>
            <Chip tone="mutate">Mutate</Chip>
            <Chip tone="ok">Ok</Chip>
            <Chip tone="warn">Warn</Chip>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {CHANNELS.map((channel) => (
              <Chip key={channel} channel={channel}>
                ch{channel}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Panel">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Panel title="Variables">
              <div className="flex flex-col gap-2 p-3">
                <div className="flex items-center justify-between font-body text-sm">
                  <span className="text-ink-soft">lo</span>
                  <span className="text-ink">0</span>
                </div>
                <div className="flex items-center justify-between font-body text-sm">
                  <span className="text-ink-soft">hi</span>
                  <span className="text-ink">9</span>
                </div>
              </div>
            </Panel>
            <Panel title="Console" actions={<Chip tone="neutral">idle</Chip>}>
              <EmptyState title="No output yet" description="Panels reserve their space before a trace loads." />
            </Panel>
          </div>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="array">
            <TabsList>
              <TabsTrigger value="array">Array</TabsTrigger>
              <TabsTrigger value="call_stack">Call stack</TabsTrigger>
              <TabsTrigger value="variables">Variables</TabsTrigger>
            </TabsList>
            <TabsContent value="array">
              <p className="font-body text-sm text-ink-soft">Panel registry v1 member: array.</p>
            </TabsContent>
            <TabsContent value="call_stack">
              <p className="font-body text-sm text-ink-soft">Panel registry v1 member: call_stack.</p>
            </TabsContent>
            <TabsContent value="variables">
              <p className="font-body text-sm text-ink-soft">Panel registry v1 member: variables.</p>
            </TabsContent>
          </Tabs>
        </Section>

        <Section title="Table" description="Reference: the channel-color scale.">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Channel</TableHeaderCell>
                <TableHeaderCell>Token</TableHeaderCell>
                <TableHeaderCell>Swatch</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {CHANNELS.map((channel) => (
                <TableRow key={channel}>
                  <TableCell>ch{channel}</TableCell>
                  <TableCell className="font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
                    --color-ch-{channel}
                  </TableCell>
                  <TableCell>
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: `var(--color-ch-${channel})` }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>

        <Section title="Resizable split">
          <div className="h-48 border border-rule">
            <ResizableSplit orientation="horizontal">
              <ResizablePane defaultSize="35%" minSize="20%">
                <div className="flex h-full items-center justify-center font-body text-sm text-ink-soft">
                  Pane A
                </div>
              </ResizablePane>
              <ResizableHandle orientation="horizontal" />
              <ResizablePane minSize="20%">
                <div className="flex h-full items-center justify-center font-body text-sm text-ink-soft">
                  Pane B
                </div>
              </ResizablePane>
            </ResizableSplit>
          </div>
        </Section>

        <Section title="Toast">
          <ToastDemo />
        </Section>

        <Section title="Empty state">
          <div className="h-40 border border-rule">
            <EmptyState title="Nothing here yet" description="Used when a panel has no data to show." />
          </div>
        </Section>

        <Section title="Command palette" description="Global — press ⌘K or Ctrl+K anywhere in the app to open it.">
          <p className="font-body text-sm text-ink-soft">
            The registry is intentionally empty in Phase 0 (docs/PRD.md item 5); later phases register commands
            in apps/web/lib/commands.ts.
          </p>
        </Section>
      </div>
    </TooltipProvider>
  );
}

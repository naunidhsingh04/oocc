"use client";

import { useState } from "react";
import { cn } from "@oocc/ui";
import { useCompilerHighlight } from "@/lib/compiler/highlightStore";
import type { AstNode } from "@/lib/compiler/types";

function summarize(node: AstNode): string {
  switch (node.kind) {
    case "Number":
      return `Number ${node.value}`;
    case "Bool":
      return `Bool ${node.value}`;
    case "Variable":
      return `Variable "${node.name}"`;
    case "Unary":
      return `Unary ${node.op}`;
    case "Binary":
      return `Binary ${node.op}`;
    case "Assign":
      return `Assign "${node.name}"`;
    case "Let":
      return `Let "${node.name}"`;
    case "Print":
      return "Print";
    case "ExprStmt":
      return "ExprStmt";
    case "Block":
      return `Block (${node.statements.length})`;
    case "If":
      return "If" + (node.else ? "/else" : "");
    case "While":
      return "While";
    case "Program":
      return `Program (${node.statements.length})`;
    default:
      return (node as { kind: string }).kind;
  }
}

function childrenOf(node: AstNode): AstNode[] {
  switch (node.kind) {
    case "Unary":
      return [node.operand];
    case "Binary":
      return [node.left, node.right];
    case "Assign":
      return [node.value];
    case "Let":
      return [node.init];
    case "Print":
      return [node.value];
    case "ExprStmt":
      return [node.expr];
    case "Block":
      return node.statements;
    case "If":
      return node.else ? [node.condition, node.then, node.else] : [node.condition, node.then];
    case "While":
      return [node.condition, node.body];
    case "Program":
      return node.statements;
    default:
      return [];
  }
}

interface TreeRowProps {
  node: AstNode;
  depth: number;
}

function TreeRow({ node, depth }: TreeRowProps) {
  const [collapsed, setCollapsed] = useState(false);
  const kids = childrenOf(node);
  const hoverAstId = useCompilerHighlight((s) => s.hoverAstId);
  const selectedAstId = useCompilerHighlight((s) => s.selectedAstId);
  const setHover = useCompilerHighlight((s) => s.setHover);
  const setSelected = useCompilerHighlight((s) => s.setSelected);

  const isSelected = node.id === selectedAstId;
  const isHovered = node.id === hoverAstId;

  return (
    <div>
      <div
        className={cn(
          "flex cursor-pointer items-center gap-1 rounded-control px-1 py-0.5 font-mono-label text-[11px]",
          isSelected && "bg-[color-mix(in_srgb,var(--color-signal)_16%,transparent)] text-signal",
          isHovered && !isSelected && "bg-[color-mix(in_srgb,var(--color-signal)_8%,transparent)]",
        )}
        style={{ paddingLeft: depth * 14 + 4 }}
        onMouseEnter={() => setHover(node.id)}
        onMouseLeave={() => setHover(null)}
        onClick={(event) => {
          event.stopPropagation();
          setSelected(node.id);
        }}
      >
        {kids.length > 0 ? (
          <button
            type="button"
            aria-label={collapsed ? "Expand" : "Collapse"}
            className="w-3 shrink-0 text-ink-soft"
            onClick={(event) => {
              event.stopPropagation();
              setCollapsed((v) => !v);
            }}
          >
            {collapsed ? "+" : "−"}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="text-ink-soft">#{node.id}</span>
        <span className="text-ink">{summarize(node)}</span>
      </div>
      {!collapsed && kids.map((child) => <TreeRow key={child.id} node={child} depth={depth + 1} />)}
    </div>
  );
}

export interface AstPaneProps {
  ast: AstNode | null;
}

/** The AST as a collapsible tree (docs/PRD.md §7). */
export function AstPane({ ast }: AstPaneProps) {
  if (!ast) {
    return <div className="p-2 font-mono-label text-[11px] text-ink-soft">No AST yet.</div>;
  }
  return (
    <div className="h-full overflow-y-auto p-1" data-testid="compiler-ast-pane">
      <TreeRow node={ast} depth={0} />
    </div>
  );
}

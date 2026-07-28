import type { AstNode, BytecodeChunk, Instruction } from "./types";

function children(node: AstNode): AstNode[] {
  switch (node.kind) {
    case "Number":
    case "Bool":
    case "Variable":
      return [];
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

/** Every AST node, keyed by its stable parse-order id, for O(1) astId -> node lookups. */
export function buildAstIndex(root: AstNode): Map<number, AstNode> {
  const index = new Map<number, AstNode>();
  const stack: AstNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    index.set(node.id, node);
    stack.push(...children(node));
  }
  return index;
}

/** Every bytecode instruction that a given AST node produced — usually one, occasionally more. */
export function buildInstructionIndex(chunk: BytecodeChunk): Map<number, Instruction[]> {
  const index = new Map<number, Instruction[]>();
  for (const instruction of chunk.instructions) {
    const list = index.get(instruction.astId);
    if (list) {
      list.push(instruction);
    } else {
      index.set(instruction.astId, [instruction]);
    }
  }
  return index;
}

/**
 * The smallest (most specific) AST node whose span contains a byte offset
 * — this is what lets clicking/hovering a raw source character or a token
 * resolve to "which expression is this," the same way a debugger resolves
 * a click in a disassembly view back to its source line, just one level
 * more precise (span, not just line).
 */
export function findEnclosingNodeId(root: AstNode, offset: number): number | null {
  let best: AstNode | null = null;
  const stack: AstNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (offset < node.span.start || offset > node.span.end) continue;
    if (!best || node.span.end - node.span.start < best.span.end - best.span.start) {
      best = node;
    }
    stack.push(...children(node));
  }
  return best?.id ?? null;
}

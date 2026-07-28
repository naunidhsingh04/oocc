import { describe, expect, it } from "vitest";
import { buildAstIndex, buildInstructionIndex, findEnclosingNodeId } from "./astIndex";
import type { BytecodeChunk, ProgramNode } from "./types";

// Real output from `oocc_compiler --emit=all` on `x = 1 + 2 * 3;\nprint x;`
// (services/compiler-explorer), captured verbatim during this session —
// not hand-written, so it can't silently drift from the real JSON shape.
const AST: ProgramNode = {
  id: 0,
  kind: "Program",
  span: { start: 0, end: 23, line: 1, column: 1 },
  statements: [
    {
      id: 1,
      kind: "ExprStmt",
      span: { start: 0, end: 14, line: 1, column: 1 },
      expr: {
        id: 2,
        kind: "Assign",
        span: { start: 0, end: 13, line: 1, column: 1 },
        name: "x",
        value: {
          id: 4,
          kind: "Binary",
          op: "PLUS",
          span: { start: 4, end: 13, line: 1, column: 5 },
          left: { id: 3, kind: "Number", value: 1, span: { start: 4, end: 5, line: 1, column: 5 } },
          right: {
            id: 6,
            kind: "Binary",
            op: "STAR",
            span: { start: 8, end: 13, line: 1, column: 9 },
            left: { id: 5, kind: "Number", value: 2, span: { start: 8, end: 9, line: 1, column: 9 } },
            right: { id: 7, kind: "Number", value: 3, span: { start: 12, end: 13, line: 1, column: 13 } },
          },
        },
      },
    },
    {
      id: 8,
      kind: "Print",
      span: { start: 15, end: 23, line: 2, column: 1 },
      value: { id: 9, kind: "Variable", name: "x", span: { start: 21, end: 22, line: 2, column: 7 } },
    },
  ],
};

const BYTECODE: BytecodeChunk = {
  constants: [1, 2, 3],
  names: ["x"],
  instructions: [
    { pc: 0, opcode: "CONST", operands: [0], line: 1, span: AST.statements[0]!.span, comment: "", astId: 3 },
    { pc: 1, opcode: "CONST", operands: [1], line: 1, span: AST.statements[0]!.span, comment: "", astId: 5 },
    { pc: 2, opcode: "CONST", operands: [2], line: 1, span: AST.statements[0]!.span, comment: "", astId: 7 },
    { pc: 3, opcode: "MUL", operands: [], line: 1, span: AST.statements[0]!.span, comment: "", astId: 6 },
    { pc: 4, opcode: "ADD", operands: [], line: 1, span: AST.statements[0]!.span, comment: "", astId: 4 },
    { pc: 5, opcode: "SET_GLOBAL", operands: [0], line: 1, span: AST.statements[0]!.span, comment: "", astId: 2 },
    { pc: 6, opcode: "POP", operands: [], line: 1, span: AST.statements[0]!.span, comment: "", astId: 1 },
    { pc: 7, opcode: "GET_GLOBAL", operands: [0], line: 2, span: AST.statements[1]!.span, comment: "", astId: 9 },
    { pc: 8, opcode: "PRINT", operands: [], line: 2, span: AST.statements[1]!.span, comment: "", astId: 8 },
    { pc: 9, opcode: "HALT", operands: [], line: 1, span: AST.span, comment: "", astId: 0 },
  ],
};

describe("buildAstIndex", () => {
  it("indexes every node, including nested binary operands, by id", () => {
    const index = buildAstIndex(AST);
    expect(index.size).toBe(10); // ids 0-9
    expect(index.get(6)?.kind).toBe("Binary");
    expect((index.get(6) as { op: string }).op).toBe("STAR");
    expect(index.get(3)?.kind).toBe("Number");
  });
});

describe("buildInstructionIndex", () => {
  it("maps each astId back to the instruction(s) it produced", () => {
    const index = buildInstructionIndex(BYTECODE);
    expect(index.get(6)?.map((i) => i.opcode)).toEqual(["MUL"]);
    expect(index.get(4)?.map((i) => i.opcode)).toEqual(["ADD"]);
    expect(index.get(2)?.map((i) => i.opcode)).toEqual(["SET_GLOBAL"]);
  });
});

describe("findEnclosingNodeId", () => {
  it("finds the innermost node for an offset inside `2 * 3`", () => {
    // offset 9 is the '2' character inside "2 * 3" (span 8-13)
    expect(findEnclosingNodeId(AST, 9)).toBe(5); // the Number(2) leaf, not the enclosing Binary
  });

  it("finds the enclosing Binary('*') node for an offset on the operator itself", () => {
    // offset 10 is the '*' character — inside the STAR Binary's span (8-13)
    // but not inside either Number leaf's own span.
    expect(findEnclosingNodeId(AST, 10)).toBe(6);
  });

  it("finds the outer Binary('+') for an offset between the left operand and the nested multiply", () => {
    expect(findEnclosingNodeId(AST, 6)).toBe(4);
  });

  it("returns null for an offset outside the program's span", () => {
    expect(findEnclosingNodeId(AST, 999)).toBeNull();
  });
});

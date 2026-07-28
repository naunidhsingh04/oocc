/**
 * Mirrors services/compiler-explorer's real JSON output exactly (verified
 * against the actual native/WASM build during this session, not guessed
 * from the PRD prose) — see that service's `include/oocc_compiler/*.hpp`
 * and `src/trace.cpp` for the canonical source. Every field name here is
 * load-bearing: `astId` and `span` are what let all five panes
 * cross-highlight.
 */

export interface Span {
  start: number;
  end: number;
  line: number;
  column: number;
}

export interface Token {
  type: string;
  lexeme: string;
  line: number;
  column: number;
  start: number;
  end: number;
}

interface AstNodeBase {
  id: number;
  span: Span;
}

export interface NumberNode extends AstNodeBase {
  kind: "Number";
  value: number;
}
export interface BoolNode extends AstNodeBase {
  kind: "Bool";
  value: boolean;
}
export interface VariableNode extends AstNodeBase {
  kind: "Variable";
  name: string;
}
export interface UnaryNode extends AstNodeBase {
  kind: "Unary";
  op: string;
  operand: AstNode;
}
export interface BinaryNode extends AstNodeBase {
  kind: "Binary";
  op: string;
  left: AstNode;
  right: AstNode;
}
export interface AssignNode extends AstNodeBase {
  kind: "Assign";
  name: string;
  value: AstNode;
}
export interface LetNode extends AstNodeBase {
  kind: "Let";
  name: string;
  init: AstNode;
}
export interface PrintNode extends AstNodeBase {
  kind: "Print";
  value: AstNode;
}
export interface ExprStmtNode extends AstNodeBase {
  kind: "ExprStmt";
  expr: AstNode;
}
export interface BlockNode extends AstNodeBase {
  kind: "Block";
  statements: AstNode[];
}
export interface IfNode extends AstNodeBase {
  kind: "If";
  condition: AstNode;
  then: AstNode;
  else: AstNode | null;
}
export interface WhileNode extends AstNodeBase {
  kind: "While";
  condition: AstNode;
  body: AstNode;
}
export interface ProgramNode extends AstNodeBase {
  kind: "Program";
  statements: AstNode[];
}

export type AstNode =
  | NumberNode
  | BoolNode
  | VariableNode
  | UnaryNode
  | BinaryNode
  | AssignNode
  | LetNode
  | PrintNode
  | ExprStmtNode
  | BlockNode
  | IfNode
  | WhileNode
  | ProgramNode;

/** Every opcode this VM has (`include/oocc_compiler/opcode.hpp`). */
export type OpCode =
  | "CONST"
  | "TRUE"
  | "FALSE"
  | "POP"
  | "DEFINE_GLOBAL"
  | "GET_GLOBAL"
  | "SET_GLOBAL"
  | "GET_LOCAL"
  | "SET_LOCAL"
  | "ADD"
  | "SUB"
  | "MUL"
  | "DIV"
  | "MOD"
  | "NEGATE"
  | "NOT"
  | "EQUAL"
  | "NOT_EQUAL"
  | "GREATER"
  | "GREATER_EQUAL"
  | "LESS"
  | "LESS_EQUAL"
  | "PRINT"
  | "JUMP"
  | "JUMP_IF_FALSE"
  | "LOOP"
  | "HALT";

export interface Instruction {
  pc: number;
  opcode: OpCode;
  operands: number[];
  line: number;
  span: Span;
  comment: string;
  astId: number;
}

export interface BytecodeChunk {
  constants: number[];
  names: string[];
  instructions: Instruction[];
}

export interface StackValue {
  type: "number" | "bool";
  value: number | boolean;
}

export interface VmStep {
  pc: number;
  opcode: OpCode;
  stackBefore: StackValue[];
  stackAfter: StackValue[];
  globals: Record<string, StackValue>;
  stdoutDelta: string;
}

export type PipelineStage = "LexError" | "ParseError" | "RuntimeError";

export interface PipelineError {
  stage: PipelineStage;
  message: string;
  span: Span;
}

/**
 * The exact shape `oocc::run_pipeline` returns (`services/compiler-explorer/src/pipeline.cpp`).
 * Every field is conditionally present depending on which stage the
 * pipeline reached before failing (or reached at all, if some stages
 * weren't requested via `emit`) — a lex error means only `error` is set;
 * a runtime error means `tokens`/`ast`/`bytecode`/`trace` (partial) and
 * `error` are all set together.
 */
export interface PipelineResult {
  tokens?: Token[];
  ast?: ProgramNode;
  bytecode?: BytecodeChunk;
  trace?: VmStep[];
  stdout?: string;
  error?: PipelineError;
}

export type PipelineStageName = "lex" | "parse" | "compile" | "run";

export interface StageTimings {
  lex: number | null;
  parse: number | null;
  compile: number | null;
  run: number | null;
}

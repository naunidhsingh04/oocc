#include "oocc_compiler/vm.hpp"

#include <cmath>

#include "oocc_compiler/errors.hpp"

namespace oocc {

VM::VM(Chunk chunk) : chunk_(std::move(chunk)) {}

Value VM::pop() {
    Value v = stack_.back();
    stack_.pop_back();
    return v;
}

const Value& VM::peek(int distance) const { return stack_[stack_.size() - 1 - distance]; }

void VM::push(const Value& v) { stack_.push_back(v); }

void VM::runtime_error(const Instruction& instr, const std::string& message) {
    throw OoccError(ErrorStage::Runtime, message, instr.span);
}

std::string VM::run() {
    pc_ = 0;
    while (true) {
        const Instruction& instr = chunk_.instructions[pc_];

#ifdef OOCC_TRACE
        VmStep step;
        step.pc = instr.pc;
        step.opcode = instr.opcode;
        step.stack_before = stack_;
        size_t stdout_before_len = stdout_.size();
#endif

        int next_pc = pc_ + 1;

        switch (instr.opcode) {
            case OpCode::Const:
                push(Value::make_number(chunk_.constants[instr.operands[0]]));
                break;
            case OpCode::True:
                push(Value::make_bool(true));
                break;
            case OpCode::False:
                push(Value::make_bool(false));
                break;
            case OpCode::Pop:
                pop();
                break;
            case OpCode::DefineGlobal:
                globals_[chunk_.names[instr.operands[0]]] = pop();
                break;
            case OpCode::GetGlobal: {
                const std::string& name = chunk_.names[instr.operands[0]];
                auto it = globals_.find(name);
                if (it == globals_.end()) {
                    runtime_error(instr, "Undefined variable '" + name + "'");
                }
                push(it->second);
                break;
            }
            case OpCode::SetGlobal: {
                const std::string& name = chunk_.names[instr.operands[0]];
                if (!globals_.count(name)) {
                    runtime_error(instr, "Undefined variable '" + name + "'");
                }
                globals_[name] = peek();
                break;
            }
            case OpCode::GetLocal:
                push(stack_[instr.operands[0]]);
                break;
            case OpCode::SetLocal:
                stack_[instr.operands[0]] = peek();
                break;
            case OpCode::Add: {
                Value b = pop(), a = pop();
                if (!a.is_number() || !b.is_number())
                    runtime_error(instr, "Operands to '+' must be numbers");
                push(Value::make_number(a.number + b.number));
                break;
            }
            case OpCode::Sub: {
                Value b = pop(), a = pop();
                if (!a.is_number() || !b.is_number())
                    runtime_error(instr, "Operands to '-' must be numbers");
                push(Value::make_number(a.number - b.number));
                break;
            }
            case OpCode::Mul: {
                Value b = pop(), a = pop();
                if (!a.is_number() || !b.is_number())
                    runtime_error(instr, "Operands to '*' must be numbers");
                push(Value::make_number(a.number * b.number));
                break;
            }
            case OpCode::Div: {
                Value b = pop(), a = pop();
                if (!a.is_number() || !b.is_number())
                    runtime_error(instr, "Operands to '/' must be numbers");
                if (b.number == 0.0) runtime_error(instr, "Division by zero");
                push(Value::make_number(a.number / b.number));
                break;
            }
            case OpCode::Mod: {
                Value b = pop(), a = pop();
                if (!a.is_number() || !b.is_number())
                    runtime_error(instr, "Operands to '%' must be numbers");
                if (b.number == 0.0) runtime_error(instr, "Modulo by zero");
                push(Value::make_number(std::fmod(a.number, b.number)));
                break;
            }
            case OpCode::Negate: {
                Value a = pop();
                if (!a.is_number()) runtime_error(instr, "Operand to unary '-' must be a number");
                push(Value::make_number(-a.number));
                break;
            }
            case OpCode::Not: {
                Value a = pop();
                push(Value::make_bool(!a.truthy()));
                break;
            }
            case OpCode::Equal: {
                Value b = pop(), a = pop();
                bool eq;
                if (a.type != b.type) {
                    eq = false;
                } else if (a.is_number()) {
                    eq = a.number == b.number;
                } else {
                    eq = a.boolean == b.boolean;
                }
                push(Value::make_bool(eq));
                break;
            }
            case OpCode::NotEqual: {
                Value b = pop(), a = pop();
                bool eq;
                if (a.type != b.type) {
                    eq = false;
                } else if (a.is_number()) {
                    eq = a.number == b.number;
                } else {
                    eq = a.boolean == b.boolean;
                }
                push(Value::make_bool(!eq));
                break;
            }
            case OpCode::Greater: {
                Value b = pop(), a = pop();
                if (!a.is_number() || !b.is_number())
                    runtime_error(instr, "Operands to '>' must be numbers");
                push(Value::make_bool(a.number > b.number));
                break;
            }
            case OpCode::GreaterEqual: {
                Value b = pop(), a = pop();
                if (!a.is_number() || !b.is_number())
                    runtime_error(instr, "Operands to '>=' must be numbers");
                push(Value::make_bool(a.number >= b.number));
                break;
            }
            case OpCode::Less: {
                Value b = pop(), a = pop();
                if (!a.is_number() || !b.is_number())
                    runtime_error(instr, "Operands to '<' must be numbers");
                push(Value::make_bool(a.number < b.number));
                break;
            }
            case OpCode::LessEqual: {
                Value b = pop(), a = pop();
                if (!a.is_number() || !b.is_number())
                    runtime_error(instr, "Operands to '<=' must be numbers");
                push(Value::make_bool(a.number <= b.number));
                break;
            }
            case OpCode::Print: {
                Value v = pop();
                stdout_ += v.to_display_string();
                stdout_ += "\n";
                break;
            }
            case OpCode::Jump:
                next_pc = instr.operands[0];
                break;
            case OpCode::JumpIfFalse:
                if (!peek().truthy()) next_pc = instr.operands[0];
                break;
            case OpCode::Loop:
                next_pc = instr.operands[0];
                break;
            case OpCode::Halt:
#ifdef OOCC_TRACE
                step.stack_after = stack_;
                step.globals = globals_;
                step.stdout_delta = stdout_.substr(stdout_before_len);
                steps_.push_back(step);
#endif
                return stdout_;
        }

#ifdef OOCC_TRACE
        step.stack_after = stack_;
        step.globals = globals_;
        step.stdout_delta = stdout_.substr(stdout_before_len);
        steps_.push_back(step);
#endif

        pc_ = next_pc;
        if (pc_ < 0 || pc_ >= static_cast<int>(chunk_.instructions.size())) {
            runtime_error(instr, "Program counter ran off the end of bytecode");
        }
    }
}

}  // namespace oocc

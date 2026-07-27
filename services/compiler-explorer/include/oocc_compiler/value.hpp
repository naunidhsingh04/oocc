#pragma once
#include <string>

namespace oocc {

enum class ValueType { Number, Bool };

// The VM's only two runtime value kinds. Deliberately minimal: this is a
// teaching language for "why is `a + b * c` not `(a + b) * c`" and
// "how does a while-loop lower to jumps," not a general-purpose runtime,
// so strings/objects/functions are out of scope (see the track brief:
// "variables, arithmetic/comparison expressions, conditionals, while
// loops, print").
struct Value {
    ValueType type = ValueType::Number;
    double number = 0.0;
    bool boolean = false;

    static Value make_number(double n) {
        Value v;
        v.type = ValueType::Number;
        v.number = n;
        return v;
    }
    static Value make_bool(bool b) {
        Value v;
        v.type = ValueType::Bool;
        v.boolean = b;
        return v;
    }

    bool is_number() const { return type == ValueType::Number; }
    bool is_bool() const { return type == ValueType::Bool; }
    bool truthy() const { return is_bool() ? boolean : number != 0.0; }

    // Canonical text form used both for `print` output and for the VM
    // trace's stack snapshots. Numbers print without a trailing ".0" when
    // they are integral, so `print 1 + 1;` reads "2", not "2.0".
    std::string to_display_string() const;
};

}  // namespace oocc
